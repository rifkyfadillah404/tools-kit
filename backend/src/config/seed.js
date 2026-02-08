const bcrypt = require('bcryptjs');
const pool = require('./database');

async function seed() {
  try {
    // Hash passwords
    const adminPassword = await bcrypt.hash('admin123', 10);
    const petugasPassword = await bcrypt.hash('petugas123', 10);
    const peminjamPassword = await bcrypt.hash('peminjam123', 10);

    // Seed users - 3 roles: admin, petugas, peminjam
    await pool.query(`
      INSERT IGNORE INTO users (name, email, password_hash, role) VALUES
      ('Administrator', 'admin@example.com', ?, 'admin'),
      ('Petugas Gudang', 'petugas@example.com', ?, 'petugas'),
      ('Budi Santoso', 'peminjam@example.com', ?, 'peminjam'),
      ('Ani Wijaya', 'ani@example.com', ?, 'peminjam'),
      ('Citra Dewi', 'citra@example.com', ?, 'peminjam')
    `, [adminPassword, petugasPassword, peminjamPassword, peminjamPassword, peminjamPassword]);
    console.log('Users seeded.');

    // Seed categories
    await pool.query(`
      INSERT IGNORE INTO categories (id, name, description) VALUES
      (1, 'Alat Tangan', 'Perkakas manual seperti obeng, palu, tang'),
      (2, 'Alat Listrik', 'Perkakas bertenaga listrik seperti bor, gerinda'),
      (3, 'Alat Ukur', 'Alat pengukuran seperti meteran, jangka sorong'),
      (4, 'Alat Keselamatan', 'APD seperti helm, sarung tangan, kacamata'),
      (5, 'Elektronik', 'Peralatan elektronik seperti multimeter, solder')
    `);
    console.log('Categories seeded.');

    // Seed tools dengan stock
    await pool.query(`
      INSERT IGNORE INTO tools (id, category_id, name, asset_tag, description, location, stock, available_stock, status) VALUES
      (1, 1, 'Obeng Set Phillips', 'TL-001', 'Set obeng phillips berbagai ukuran', 'Rak A1', 5, 5, 'available'),
      (2, 1, 'Palu Karet', 'TL-002', 'Palu dengan kepala karet', 'Rak A1', 3, 3, 'available'),
      (3, 1, 'Tang Kombinasi', 'TL-003', 'Tang serbaguna', 'Rak A2', 4, 4, 'available'),
      (4, 2, 'Bor Listrik Bosch', 'TL-004', 'Bor listrik 500W dengan chuck 13mm', 'Rak B1', 2, 2, 'available'),
      (5, 2, 'Gerinda Tangan', 'TL-005', 'Gerinda sudut 4 inch', 'Rak B1', 2, 2, 'available'),
      (6, 3, 'Meteran 5m', 'TL-006', 'Meteran roll 5 meter', 'Rak C1', 10, 10, 'available'),
      (7, 3, 'Jangka Sorong Digital', 'TL-007', 'Jangka sorong digital 150mm', 'Rak C1', 3, 3, 'available'),
      (8, 4, 'Helm Proyek', 'TL-008', 'Helm keselamatan standar SNI', 'Rak D1', 10, 10, 'available'),
      (9, 4, 'Kacamata Safety', 'TL-009', 'Kacamata pelindung transparan', 'Rak D1', 15, 15, 'available'),
      (10, 5, 'Multimeter Digital', 'TL-010', 'Multimeter digital dengan auto-range', 'Rak E1', 4, 4, 'available'),
      (11, 5, 'Solder Station', 'TL-011', 'Solder dengan pengatur suhu', 'Rak E1', 3, 3, 'available'),
      (12, 2, 'Jigsaw Makita', 'TL-012', 'Gergaji jigsaw listrik', 'Rak B2', 2, 2, 'available')
    `);
    console.log('Tools seeded.');

    // Seed unit per tool untuk model unit-level
    const [tools] = await pool.query('SELECT id, asset_tag, stock FROM tools ORDER BY id ASC');

    for (const tool of tools) {
      const stock = Number(tool.stock) || 0;
      for (let idx = 1; idx <= stock; idx += 1) {
        const unitCode = `${tool.asset_tag || `TOOL-${tool.id}`}-${String(idx).padStart(3, '0')}`;
        await pool.query(
          `
            INSERT IGNORE INTO tool_units (tool_id, unit_code, status)
            VALUES (?, ?, 'available')
          `,
          [tool.id, unitCode]
        );
      }

      await pool.query('CALL sp_sync_tool_stock(?)', [tool.id]);
    }
    console.log('Tool units seeded.');

    console.log('Seed completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }
}

seed();
