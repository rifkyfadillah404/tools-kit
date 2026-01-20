const mysql = require('mysql2/promise');
const config = require('./index');

const migrations = `
-- Drop existing tables if needed for fresh start
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS loan_items;
DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS loan_request_items;
DROP TABLE IF EXISTS loan_requests;
DROP TABLE IF EXISTS tools;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- Users table dengan 3 role: admin, petugas, peminjam
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'petugas', 'peminjam') NOT NULL DEFAULT 'peminjam',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tools table
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

-- Peminjaman table (loan requests + loans combined)
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

-- Pengembalian table (untuk tracking detail pengembalian)
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

-- Log aktivitas table
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

-- Indexes
CREATE INDEX idx_tools_status ON tools(status);
CREATE INDEX idx_tools_category ON tools(category_id);
CREATE INDEX idx_peminjaman_status ON peminjaman(status);
CREATE INDEX idx_peminjaman_peminjam ON peminjaman(peminjam_id);
CREATE INDEX idx_log_aktivitas_user ON log_aktivitas(user_id);
CREATE INDEX idx_log_aktivitas_action ON log_aktivitas(action);
`;

const storedProcedures = `
-- Stored Procedure: Proses Peminjaman
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
  DECLARE v_available INT;

  -- Check available stock
  SELECT available_stock INTO v_available FROM tools WHERE id = p_tool_id;

  IF v_available >= p_qty THEN
    INSERT INTO peminjaman (peminjam_id, tool_id, qty, tanggal_pinjam, tanggal_kembali_rencana, catatan, status)
    VALUES (p_peminjam_id, p_tool_id, p_qty, p_tanggal_pinjam, p_tanggal_kembali, p_catatan, 'pending');

    SELECT LAST_INSERT_ID() as peminjaman_id, 'success' as status, 'Peminjaman berhasil diajukan' as message;
  ELSE
    SELECT 0 as peminjaman_id, 'error' as status, 'Stok tidak mencukupi' as message;
  END IF;
END;

-- Stored Procedure: Approve Peminjaman
DROP PROCEDURE IF EXISTS sp_approve_peminjaman;
CREATE PROCEDURE sp_approve_peminjaman(
  IN p_peminjaman_id INT,
  IN p_petugas_id INT
)
BEGIN
  DECLARE v_qty INT;
  DECLARE v_tool_id INT;
  DECLARE v_status VARCHAR(20);

  SELECT qty, tool_id, status INTO v_qty, v_tool_id, v_status
  FROM peminjaman WHERE id = p_peminjaman_id;

  IF v_status = 'pending' THEN
    START TRANSACTION;

    UPDATE peminjaman
    SET status = 'approved', approved_by = p_petugas_id, approved_at = NOW()
    WHERE id = p_peminjaman_id;

    COMMIT;
    SELECT 'success' as status, 'Peminjaman disetujui' as message;
  ELSE
    SELECT 'error' as status, 'Status peminjaman tidak valid' as message;
  END IF;
END;

-- Stored Procedure: Checkout (serahkan alat)
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
  DECLARE v_available INT;

  SELECT qty, tool_id, status INTO v_qty, v_tool_id, v_status
  FROM peminjaman WHERE id = p_peminjaman_id;

  SELECT available_stock INTO v_available FROM tools WHERE id = v_tool_id;

  IF v_status = 'approved' AND v_available >= v_qty THEN
    START TRANSACTION;

    UPDATE peminjaman
    SET status = 'dipinjam', checkout_by = p_petugas_id, checkout_at = NOW(), kondisi_keluar = p_kondisi
    WHERE id = p_peminjaman_id;

    UPDATE tools SET available_stock = available_stock - v_qty WHERE id = v_tool_id;

    -- Update status if no stock left
    UPDATE tools SET status = 'not_available' WHERE id = v_tool_id AND available_stock <= 0;

    COMMIT;
    SELECT 'success' as status, 'Alat berhasil diserahkan' as message;
  ELSE
    SELECT 'error' as status, 'Stok tidak mencukupi atau status tidak valid' as message;
  END IF;
END;

-- Stored Procedure: Pengembalian dengan Denda
DROP PROCEDURE IF EXISTS sp_kembalikan_alat;
CREATE PROCEDURE sp_kembalikan_alat(
  IN p_peminjaman_id INT,
  IN p_petugas_id INT,
  IN p_kondisi TEXT,
  IN p_keterangan TEXT
)
BEGIN
  DECLARE v_qty INT;
  DECLARE v_tool_id INT;
  DECLARE v_status VARCHAR(20);
  DECLARE v_tanggal_rencana DATE;
  DECLARE v_hari_telat INT;
  DECLARE v_denda DECIMAL(10,2);
  DECLARE v_denda_per_hari DECIMAL(10,2) DEFAULT 5000;

  SELECT qty, tool_id, status, tanggal_kembali_rencana
  INTO v_qty, v_tool_id, v_status, v_tanggal_rencana
  FROM peminjaman WHERE id = p_peminjaman_id;

  IF v_status = 'dipinjam' THEN
    -- Hitung hari telat
    SET v_hari_telat = DATEDIFF(CURDATE(), v_tanggal_rencana);
    IF v_hari_telat < 0 THEN SET v_hari_telat = 0; END IF;

    -- Hitung denda
    SET v_denda = v_hari_telat * v_denda_per_hari;

    START TRANSACTION;

    -- Update peminjaman
    UPDATE peminjaman
    SET status = 'dikembalikan',
        return_by = p_petugas_id,
        return_at = NOW(),
        tanggal_kembali_aktual = CURDATE(),
        kondisi_masuk = p_kondisi,
        denda = v_denda
    WHERE id = p_peminjaman_id;

    -- Insert pengembalian record
    INSERT INTO pengembalian (peminjaman_id, tanggal_kembali, kondisi, denda, keterangan, petugas_id)
    VALUES (p_peminjaman_id, CURDATE(), p_kondisi, v_denda, p_keterangan, p_petugas_id);

    -- Update tool stock
    UPDATE tools SET available_stock = available_stock + v_qty WHERE id = v_tool_id;
    UPDATE tools SET status = 'available' WHERE id = v_tool_id AND available_stock > 0;

    COMMIT;
    SELECT 'success' as status, 'Alat berhasil dikembalikan' as message, v_denda as denda, v_hari_telat as hari_telat;
  ELSE
    ROLLBACK;
    SELECT 'error' as status, 'Status peminjaman tidak valid' as message, 0 as denda, 0 as hari_telat;
  END IF;
END;
`;

const functions = `
-- Function: Hitung Denda
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

-- Function: Cek Ketersediaan Alat
DROP FUNCTION IF EXISTS fn_cek_ketersediaan;
CREATE FUNCTION fn_cek_ketersediaan(p_tool_id INT, p_qty INT)
RETURNS BOOLEAN
DETERMINISTIC
BEGIN
  DECLARE v_available INT;

  SELECT available_stock INTO v_available FROM tools WHERE id = p_tool_id;

  RETURN v_available >= p_qty;
END;
`;

const triggers = `
-- Trigger: Log aktivitas setelah insert peminjaman
DROP TRIGGER IF EXISTS trg_after_peminjaman_insert;
CREATE TRIGGER trg_after_peminjaman_insert
AFTER INSERT ON peminjaman
FOR EACH ROW
BEGIN
  INSERT INTO log_aktivitas (user_id, action, entity_type, entity_id, description)
  VALUES (NEW.peminjam_id, 'CREATE', 'peminjaman', NEW.id,
          CONCAT('Pengajuan peminjaman alat ID: ', NEW.tool_id));
END;

-- Trigger: Log aktivitas setelah update status peminjaman
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

-- Trigger: Log aktivitas setelah pengembalian
DROP TRIGGER IF EXISTS trg_after_pengembalian_insert;
CREATE TRIGGER trg_after_pengembalian_insert
AFTER INSERT ON pengembalian
FOR EACH ROW
BEGIN
  INSERT INTO log_aktivitas (user_id, action, entity_type, entity_id, description)
  VALUES (NEW.petugas_id, 'RETURN', 'pengembalian', NEW.id,
          CONCAT('Pengembalian peminjaman ID: ', NEW.peminjaman_id, ', Denda: Rp ', NEW.denda));
END;

-- Trigger: Log aktivitas setelah insert/update/delete tools
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

    // Create database
    await connection.query('CREATE DATABASE IF NOT EXISTS ' + config.db.database + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('Database "' + config.db.database + '" ready.');

    await connection.query('USE ' + config.db.database);

    // Run migrations
    await connection.query(migrations);
    console.log('Tables created.');

    // Create stored procedures
    const procedures = storedProcedures.split('DROP PROCEDURE').filter(p => p.trim());
    for (const proc of procedures) {
      if (proc.trim()) {
        try {
          await connection.query('DROP PROCEDURE' + proc);
        } catch (e) {
          // Ignore errors
        }
      }
    }
    console.log('Stored procedures created.');

    // Create functions
    const funcs = functions.split('DROP FUNCTION').filter(f => f.trim());
    for (const func of funcs) {
      if (func.trim()) {
        try {
          await connection.query('DROP FUNCTION' + func);
        } catch (e) {
          // Ignore errors
        }
      }
    }
    console.log('Functions created.');

    // Create triggers
    const trigs = triggers.split('DROP TRIGGER').filter(t => t.trim());
    for (const trig of trigs) {
      if (trig.trim()) {
        try {
          await connection.query('DROP TRIGGER' + trig);
        } catch (e) {
          // Ignore errors
        }
      }
    }
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
