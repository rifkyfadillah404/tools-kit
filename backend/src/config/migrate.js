const mysql = require('mysql2/promise');
const config = require('./index');

const migrations = `
DROP TABLE IF EXISTS peminjaman_units;
DROP TABLE IF EXISTS tool_units;
DROP TABLE IF EXISTS pengembalian;
DROP TABLE IF EXISTS log_aktivitas;
DROP TABLE IF EXISTS peminjaman;
DROP TABLE IF EXISTS tools;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'petugas', 'peminjam') NOT NULL DEFAULT 'peminjam',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE tools (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT,
  name VARCHAR(150) NOT NULL,
  asset_tag VARCHAR(50) UNIQUE,
  description TEXT,
  location VARCHAR(100),
  stock INT DEFAULT 1,
  available_stock INT DEFAULT 1,
  status ENUM('available', 'not_available') DEFAULT 'available',
  photo_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE tool_units (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tool_id INT NOT NULL,
  unit_code VARCHAR(100) NOT NULL UNIQUE,
  status ENUM('available', 'dipinjam', 'maintenance', 'hilang') NOT NULL DEFAULT 'available',
  condition_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE
);

CREATE TABLE peminjaman (
  id INT PRIMARY KEY AUTO_INCREMENT,
  peminjam_id INT NOT NULL,
  tool_id INT NOT NULL,
  qty INT DEFAULT 1,
  tanggal_pinjam DATE NOT NULL,
  tanggal_kembali_rencana DATE NOT NULL,
  tanggal_kembali_aktual DATE NULL,
  status ENUM('pending', 'approved', 'rejected', 'dipinjam', 'dikembalikan') DEFAULT 'pending',
  kondisi_keluar TEXT,
  kondisi_masuk TEXT,
  catatan TEXT,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  checkout_by INT NULL,
  checkout_at TIMESTAMP NULL,
  return_by INT NULL,
  return_at TIMESTAMP NULL,
  denda DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (peminjam_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (checkout_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (return_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE peminjaman_units (
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
);

CREATE TABLE pengembalian (
  id INT PRIMARY KEY AUTO_INCREMENT,
  peminjaman_id INT NOT NULL,
  tanggal_kembali DATE NOT NULL,
  kondisi TEXT,
  denda DECIMAL(10,2) DEFAULT 0,
  keterangan TEXT,
  petugas_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (peminjaman_id) REFERENCES peminjaman(id) ON DELETE CASCADE,
  FOREIGN KEY (petugas_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE log_aktivitas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT,
  description TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_tools_status ON tools(status);
CREATE INDEX idx_tools_category ON tools(category_id);
CREATE INDEX idx_tool_units_tool_id ON tool_units(tool_id);
CREATE INDEX idx_tool_units_status ON tool_units(status);
CREATE INDEX idx_tool_units_code ON tool_units(unit_code);
CREATE INDEX idx_peminjaman_status ON peminjaman(status);
CREATE INDEX idx_peminjaman_peminjam ON peminjaman(peminjam_id);
CREATE INDEX idx_peminjaman_units_peminjaman ON peminjaman_units(peminjaman_id);
CREATE INDEX idx_peminjaman_units_tool_unit ON peminjaman_units(tool_unit_id);
CREATE INDEX idx_log_aktivitas_user ON log_aktivitas(user_id);
CREATE INDEX idx_log_aktivitas_action ON log_aktivitas(action);
`;

const storedProcedures = `
DROP PROCEDURE IF EXISTS sp_sync_tool_stock;
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
END;

DROP PROCEDURE IF EXISTS sp_ajukan_peminjaman;
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
END;

DROP PROCEDURE IF EXISTS sp_approve_peminjaman;
CREATE PROCEDURE sp_approve_peminjaman(
  IN p_peminjaman_id INT,
  IN p_petugas_id INT
)
BEGIN
  DECLARE v_status VARCHAR(20);

  SELECT status INTO v_status
  FROM peminjaman WHERE id = p_peminjaman_id;

  IF v_status = 'pending' THEN
    UPDATE peminjaman
    SET status = 'approved', approved_by = p_petugas_id, approved_at = NOW()
    WHERE id = p_peminjaman_id;

    SELECT 'success' as status, 'Peminjaman disetujui' as message;
  ELSE
    SELECT 'error' as status, 'Status peminjaman tidak valid' as message;
  END IF;
END;

DROP PROCEDURE IF EXISTS sp_checkout_peminjaman;
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
  FROM peminjaman WHERE id = p_peminjaman_id
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
END;

DROP PROCEDURE IF EXISTS sp_kembalikan_alat;
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
END;
`;

const functions = `
DROP FUNCTION IF EXISTS fn_hitung_denda;
CREATE FUNCTION fn_hitung_denda(p_peminjaman_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
  DECLARE v_tanggal_rencana DATE;
  DECLARE v_hari_telat INT;
  DECLARE v_denda DECIMAL(10,2);
  DECLARE v_denda_per_hari DECIMAL(10,2) DEFAULT 5000;

  SELECT tanggal_kembali_rencana INTO v_tanggal_rencana
  FROM peminjaman WHERE id = p_peminjaman_id;

  SET v_hari_telat = DATEDIFF(CURDATE(), v_tanggal_rencana);
  IF v_hari_telat < 0 THEN SET v_hari_telat = 0; END IF;

  SET v_denda = v_hari_telat * v_denda_per_hari;

  RETURN v_denda;
END;

DROP FUNCTION IF EXISTS fn_cek_ketersediaan;
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
END;
`;

const triggers = `
DROP TRIGGER IF EXISTS trg_after_peminjaman_insert;
CREATE TRIGGER trg_after_peminjaman_insert
AFTER INSERT ON peminjaman
FOR EACH ROW
BEGIN
  INSERT INTO log_aktivitas (user_id, action, entity_type, entity_id, description)
  VALUES (NEW.peminjam_id, 'CREATE', 'peminjaman', NEW.id,
          CONCAT('Pengajuan peminjaman alat ID: ', NEW.tool_id));
END;

DROP TRIGGER IF EXISTS trg_after_peminjaman_update;
CREATE TRIGGER trg_after_peminjaman_update
AFTER UPDATE ON peminjaman
FOR EACH ROW
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO log_aktivitas (user_id, action, entity_type, entity_id, description)
    VALUES (
      COALESCE(NEW.approved_by, NEW.checkout_by, NEW.return_by, NEW.peminjam_id),
      CONCAT('STATUS_', UPPER(NEW.status)),
      'peminjaman',
      NEW.id,
      CONCAT('Status berubah dari ', OLD.status, ' ke ', NEW.status)
    );
  END IF;
END;

DROP TRIGGER IF EXISTS trg_after_pengembalian_insert;
CREATE TRIGGER trg_after_pengembalian_insert
AFTER INSERT ON pengembalian
FOR EACH ROW
BEGIN
  INSERT INTO log_aktivitas (user_id, action, entity_type, entity_id, description)
  VALUES (NEW.petugas_id, 'RETURN', 'pengembalian', NEW.id,
          CONCAT('Pengembalian peminjaman ID: ', NEW.peminjaman_id, ', Denda: Rp ', NEW.denda));
END;

DROP TRIGGER IF EXISTS trg_after_tool_insert;
CREATE TRIGGER trg_after_tool_insert
AFTER INSERT ON tools
FOR EACH ROW
BEGIN
  INSERT INTO log_aktivitas (user_id, action, entity_type, entity_id, description)
  VALUES (NULL, 'CREATE', 'tool', NEW.id, CONCAT('Alat baru: ', NEW.name));
END;

DROP TRIGGER IF EXISTS trg_after_tool_update;
CREATE TRIGGER trg_after_tool_update
AFTER UPDATE ON tools
FOR EACH ROW
BEGIN
  INSERT INTO log_aktivitas (user_id, action, entity_type, entity_id, description)
  VALUES (NULL, 'UPDATE', 'tool', NEW.id, CONCAT('Update alat: ', NEW.name));
END;
`;

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      multipleStatements: true,
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS ${config.db.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database "${config.db.database}" ready.`);

    await connection.query(`USE ${config.db.database}`);

    await connection.query(migrations);
    console.log('Tables created.');

    await connection.query(storedProcedures);
    console.log('Stored procedures created.');

    await connection.query(functions);
    console.log('Functions created.');

    await connection.query(triggers);
    console.log('Triggers created.');

    console.log('Migration completed successfully.');
    await connection.end();
  } catch (error) {
    console.error('Migration failed:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

migrate();
