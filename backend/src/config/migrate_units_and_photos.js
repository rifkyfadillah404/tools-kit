const pool = require('./database');

const ensureMigrationTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(150) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const isApplied = async (name) => {
  const [rows] = await pool.query('SELECT id FROM schema_migrations WHERE name = ? LIMIT 1', [name]);
  return rows.length > 0;
};

const markApplied = async (connection, name) => {
  await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
};

const addColumnsIfMissing = async (connection) => {
  const [toolColumns] = await connection.query('SHOW COLUMNS FROM tools');
  const columnNames = new Set(toolColumns.map((col) => col.Field));

  if (!columnNames.has('photo_url')) {
    await connection.query('ALTER TABLE tools ADD COLUMN photo_url VARCHAR(255) NULL AFTER status');
  }
};

const ensureIndex = async (connection, tableName, indexName, indexDDL) => {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );

  if (rows.length === 0) {
    await connection.query(indexDDL);
  }
};

const ensureUnitTables = async (connection) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS tool_units (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tool_id INT NOT NULL,
      unit_code VARCHAR(100) NOT NULL UNIQUE,
      status ENUM('available', 'dipinjam', 'maintenance', 'hilang') NOT NULL DEFAULT 'available',
      condition_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS peminjaman_units (
      id INT PRIMARY KEY AUTO_INCREMENT,
      peminjaman_id INT NOT NULL,
      tool_unit_id INT NOT NULL,
      checkout_by INT NULL,
      checkout_at TIMESTAMP NULL,
      return_by INT NULL,
      return_at TIMESTAMP NULL,
      kondisi_keluar TEXT,
      kondisi_masuk TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_peminjaman_units (peminjaman_id, tool_unit_id),
      FOREIGN KEY (peminjaman_id) REFERENCES peminjaman(id) ON DELETE CASCADE,
      FOREIGN KEY (tool_unit_id) REFERENCES tool_units(id) ON DELETE RESTRICT,
      FOREIGN KEY (checkout_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (return_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await ensureIndex(connection, 'tool_units', 'idx_tool_units_tool_id', 'CREATE INDEX idx_tool_units_tool_id ON tool_units(tool_id)');
  await ensureIndex(connection, 'tool_units', 'idx_tool_units_status', 'CREATE INDEX idx_tool_units_status ON tool_units(status)');
  await ensureIndex(connection, 'tool_units', 'idx_tool_units_code', 'CREATE INDEX idx_tool_units_code ON tool_units(unit_code)');
  await ensureIndex(connection, 'peminjaman_units', 'idx_peminjaman_units_peminjaman', 'CREATE INDEX idx_peminjaman_units_peminjaman ON peminjaman_units(peminjaman_id)');
  await ensureIndex(connection, 'peminjaman_units', 'idx_peminjaman_units_tool_unit', 'CREATE INDEX idx_peminjaman_units_tool_unit ON peminjaman_units(tool_unit_id)');
};

const createOrReplaceProceduresAndFunctions = async (connection) => {
  await connection.query('DROP PROCEDURE IF EXISTS sp_sync_tool_stock');
  await connection.query(`
    CREATE PROCEDURE sp_sync_tool_stock(IN p_tool_id INT)
    BEGIN
      DECLARE v_total_units INT DEFAULT 0;
      DECLARE v_available_units INT DEFAULT 0;

      SELECT COUNT(*), COALESCE(SUM(status = 'available'), 0)
      INTO v_total_units, v_available_units
      FROM tool_units
      WHERE tool_id = p_tool_id;

      UPDATE tools
      SET stock = v_total_units,
          available_stock = v_available_units,
          status = IF(v_available_units > 0, 'available', 'not_available')
      WHERE id = p_tool_id;
    END
  `);

  await connection.query('DROP PROCEDURE IF EXISTS sp_ajukan_peminjaman');
  await connection.query(`
    CREATE PROCEDURE sp_ajukan_peminjaman(
      IN p_peminjam_id INT,
      IN p_tool_id INT,
      IN p_qty INT,
      IN p_tanggal_pinjam DATE,
      IN p_tanggal_kembali DATE,
      IN p_catatan TEXT
    )
    BEGIN
      DECLARE v_available INT DEFAULT 0;

      SELECT COALESCE(SUM(status = 'available'), 0)
      INTO v_available
      FROM tool_units
      WHERE tool_id = p_tool_id;

      IF v_available >= p_qty THEN
        INSERT INTO peminjaman (peminjam_id, tool_id, qty, tanggal_pinjam, tanggal_kembali_rencana, catatan, status)
        VALUES (p_peminjam_id, p_tool_id, p_qty, p_tanggal_pinjam, p_tanggal_kembali, p_catatan, 'pending');

        SELECT LAST_INSERT_ID() as peminjaman_id, 'success' as status, 'Peminjaman berhasil diajukan' as message;
      ELSE
        SELECT 0 as peminjaman_id, 'error' as status, 'Stok tidak mencukupi' as message;
      END IF;
    END
  `);

  await connection.query('DROP PROCEDURE IF EXISTS sp_checkout_peminjaman');
  await connection.query(`
    CREATE PROCEDURE sp_checkout_peminjaman(
      IN p_peminjaman_id INT,
      IN p_petugas_id INT,
      IN p_kondisi TEXT
    )
    BEGIN
      DECLARE v_qty INT;
      DECLARE v_tool_id INT;
      DECLARE v_status VARCHAR(20);
      DECLARE v_selected INT DEFAULT 0;

      SELECT qty, tool_id, status INTO v_qty, v_tool_id, v_status
      FROM peminjaman
      WHERE id = p_peminjaman_id
      FOR UPDATE;

      IF v_status = 'approved' THEN
        START TRANSACTION;

        DROP TEMPORARY TABLE IF EXISTS tmp_selected_units;
        CREATE TEMPORARY TABLE tmp_selected_units (id INT PRIMARY KEY) ENGINE=MEMORY;

        INSERT INTO tmp_selected_units (id)
        SELECT id
        FROM tool_units
        WHERE tool_id = v_tool_id
          AND status = 'available'
        ORDER BY id
        LIMIT v_qty
        FOR UPDATE;

        SELECT COUNT(*) INTO v_selected FROM tmp_selected_units;

        IF v_selected < v_qty THEN
          ROLLBACK;
          DROP TEMPORARY TABLE IF EXISTS tmp_selected_units;
          SELECT 'error' as status, 'Stok tidak mencukupi atau status tidak valid' as message;
        ELSE
          UPDATE peminjaman
          SET status = 'dipinjam',
              checkout_by = p_petugas_id,
              checkout_at = NOW(),
              kondisi_keluar = p_kondisi
          WHERE id = p_peminjaman_id;

          UPDATE tool_units tu
          JOIN tmp_selected_units ts ON ts.id = tu.id
          SET tu.status = 'dipinjam',
              tu.condition_note = p_kondisi,
              tu.updated_at = NOW();

          INSERT INTO peminjaman_units (peminjaman_id, tool_unit_id, checkout_by, checkout_at, kondisi_keluar)
          SELECT p_peminjaman_id, ts.id, p_petugas_id, NOW(), p_kondisi
          FROM tmp_selected_units ts;

          CALL sp_sync_tool_stock(v_tool_id);

          COMMIT;
          DROP TEMPORARY TABLE IF EXISTS tmp_selected_units;

          SELECT
            'success' as status,
            'Alat berhasil diserahkan' as message,
            COALESCE(
              (SELECT GROUP_CONCAT(tu.unit_code ORDER BY tu.unit_code SEPARATOR ', ')
               FROM peminjaman_units pu
               JOIN tool_units tu ON tu.id = pu.tool_unit_id
               WHERE pu.peminjaman_id = p_peminjaman_id),
              ''
            ) as unit_codes;
        END IF;
      ELSE
        SELECT 'error' as status, 'Stok tidak mencukupi atau status tidak valid' as message;
      END IF;
    END
  `);

  await connection.query('DROP PROCEDURE IF EXISTS sp_kembalikan_alat');
  await connection.query(`
    CREATE PROCEDURE sp_kembalikan_alat(
      IN p_peminjaman_id INT,
      IN p_petugas_id INT,
      IN p_kondisi TEXT,
      IN p_keterangan TEXT
    )
    BEGIN
      DECLARE v_tool_id INT;
      DECLARE v_status VARCHAR(20);
      DECLARE v_tanggal_rencana DATE;
      DECLARE v_hari_telat INT;
      DECLARE v_denda DECIMAL(10,2);
      DECLARE v_denda_per_hari DECIMAL(10,2) DEFAULT 5000;
      DECLARE v_unit_status VARCHAR(20);

      SELECT tool_id, status, tanggal_kembali_rencana
      INTO v_tool_id, v_status, v_tanggal_rencana
      FROM peminjaman
      WHERE id = p_peminjaman_id
      FOR UPDATE;

      IF v_status = 'dipinjam' THEN
        SET v_hari_telat = DATEDIFF(CURDATE(), v_tanggal_rencana);
        IF v_hari_telat < 0 THEN SET v_hari_telat = 0; END IF;

        SET v_denda = v_hari_telat * v_denda_per_hari;

        IF LOWER(IFNULL(p_kondisi, '')) LIKE '%hilang%' THEN
          SET v_unit_status = 'hilang';
        ELSEIF LOWER(IFNULL(p_kondisi, '')) LIKE '%rusak%' THEN
          SET v_unit_status = 'maintenance';
        ELSE
          SET v_unit_status = 'available';
        END IF;

        START TRANSACTION;

        UPDATE peminjaman
        SET status = 'dikembalikan',
            return_by = p_petugas_id,
            return_at = NOW(),
            tanggal_kembali_aktual = CURDATE(),
            kondisi_masuk = p_kondisi,
            denda = v_denda
        WHERE id = p_peminjaman_id;

        INSERT INTO pengembalian (peminjaman_id, tanggal_kembali, kondisi, denda, keterangan, petugas_id)
        VALUES (p_peminjaman_id, CURDATE(), p_kondisi, v_denda, p_keterangan, p_petugas_id);

        UPDATE peminjaman_units
        SET return_by = p_petugas_id,
            return_at = NOW(),
            kondisi_masuk = p_kondisi,
            updated_at = NOW()
        WHERE peminjaman_id = p_peminjaman_id
          AND return_at IS NULL;

        UPDATE tool_units tu
        JOIN peminjaman_units pu ON pu.tool_unit_id = tu.id
        SET tu.status = v_unit_status,
            tu.condition_note = p_kondisi,
            tu.updated_at = NOW()
        WHERE pu.peminjaman_id = p_peminjaman_id
          AND pu.return_at IS NOT NULL;

        CALL sp_sync_tool_stock(v_tool_id);

        COMMIT;

        SELECT
          'success' as status,
          'Alat berhasil dikembalikan' as message,
          v_denda as denda,
          v_hari_telat as hari_telat,
          COALESCE(
            (SELECT GROUP_CONCAT(tu.unit_code ORDER BY tu.unit_code SEPARATOR ', ')
             FROM peminjaman_units pu
             JOIN tool_units tu ON tu.id = pu.tool_unit_id
             WHERE pu.peminjaman_id = p_peminjaman_id),
            ''
          ) as unit_codes;
      ELSE
        ROLLBACK;
        SELECT 'error' as status, 'Status peminjaman tidak valid' as message, 0 as denda, 0 as hari_telat, '' as unit_codes;
      END IF;
    END
  `);

  await connection.query('DROP FUNCTION IF EXISTS fn_cek_ketersediaan');
  await connection.query(`
    CREATE FUNCTION fn_cek_ketersediaan(p_tool_id INT, p_qty INT)
    RETURNS BOOLEAN
    DETERMINISTIC
    BEGIN
      DECLARE v_available INT;

      SELECT COALESCE(SUM(status = 'available'), 0)
      INTO v_available
      FROM tool_units
      WHERE tool_id = p_tool_id;

      RETURN v_available >= p_qty;
    END
  `);
};

const normalizeToolBaseCode = (tool) => {
  if (tool.asset_tag && String(tool.asset_tag).trim()) {
    return String(tool.asset_tag).trim().toUpperCase();
  }

  return `TOOL-${tool.id}`;
};

const pad3 = (num) => String(num).padStart(3, '0');

const backfillToolUnits = async (connection) => {
  const [tools] = await connection.query('SELECT id, asset_tag, stock, available_stock FROM tools ORDER BY id ASC');

  for (const tool of tools) {
    const stock = Number(tool.stock) > 0 ? Number(tool.stock) : 0;
    const availableStockRaw = Number(tool.available_stock);
    const availableStock = Number.isFinite(availableStockRaw)
      ? Math.max(0, Math.min(stock, availableStockRaw))
      : stock;

    const [existingUnits] = await connection.query('SELECT id FROM tool_units WHERE tool_id = ? ORDER BY id ASC', [tool.id]);

    if (existingUnits.length < stock) {
      const baseCode = normalizeToolBaseCode(tool);
      const inserts = [];

      for (let idx = existingUnits.length + 1; idx <= stock; idx += 1) {
        let candidate = `${baseCode}-${pad3(idx)}`;
        let suffix = 1;

        // eslint-disable-next-line no-await-in-loop
        while (true) {
          // eslint-disable-next-line no-await-in-loop
          const [dup] = await connection.query('SELECT id FROM tool_units WHERE unit_code = ? LIMIT 1', [candidate]);
          if (dup.length === 0) break;
          candidate = `${baseCode}-${pad3(idx)}-${suffix}`;
          suffix += 1;
        }

        inserts.push([tool.id, candidate, 'available']);
      }

      if (inserts.length > 0) {
        await connection.query(
          'INSERT INTO tool_units (tool_id, unit_code, status) VALUES ?',
          [inserts]
        );
      }
    }

    const [allUnits] = await connection.query(
      'SELECT id FROM tool_units WHERE tool_id = ? ORDER BY id ASC',
      [tool.id]
    );

    for (let index = 0; index < allUnits.length; index += 1) {
      const unitStatus = index < availableStock ? 'available' : 'dipinjam';
      await connection.query('UPDATE tool_units SET status = ? WHERE id = ?', [unitStatus, allUnits[index].id]);
    }

    await connection.query('CALL sp_sync_tool_stock(?)', [tool.id]);
  }
};

async function migrateIncremental() {
  let connection;
  const migrationName = '20260208_units_and_photos';

  try {
    await ensureMigrationTable();

    if (await isApplied(migrationName)) {
      console.log(`Migration ${migrationName} already applied.`);
      process.exit(0);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await addColumnsIfMissing(connection);
    await ensureUnitTables(connection);
    await createOrReplaceProceduresAndFunctions(connection);
    await backfillToolUnits(connection);

    await markApplied(connection, migrationName);

    await connection.commit();
    console.log('Incremental migration completed successfully.');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Incremental migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

migrateIncremental();
