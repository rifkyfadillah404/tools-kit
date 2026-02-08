const pool = require('../config/database');

const getDashboard = async (req, res) => {
  try {
    // Tools stats
    const [toolStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(status = 'available') as available,
        SUM(status = 'not_available') as not_available,
        SUM(available_stock = 0) as zero_available_stock
      FROM tools
    `);

    // Peminjaman stats
    const [peminjamanStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(status = 'pending') as pending,
        SUM(status = 'approved') as approved,
        SUM(status = 'rejected') as rejected,
        SUM(status = 'dipinjam') as dipinjam,
        SUM(status = 'dikembalikan') as dikembalikan,
        SUM(status = 'dipinjam' AND tanggal_kembali_rencana < CURDATE()) as overdue
      FROM peminjaman
    `);

    // Total denda collected (returns)
    const [dendaStats] = await pool.query(`
      SELECT
        COALESCE(SUM(denda), 0) as total_denda
      FROM pengembalian
    `);

    // Recent activity
    const [recentActivity] = await pool.query(`
      SELECT la.*, u.name as user_name
      FROM log_aktivitas la
      LEFT JOIN users u ON la.user_id = u.id
      ORDER BY la.created_at DESC
      LIMIT 10
    `);

    res.json({
      tools: toolStats[0],
      peminjaman: peminjamanStats[0],
      denda: dendaStats[0],
      recentActivity,
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const getOverdue = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
             u.name as peminjam_name,
             u.email as peminjam_email,
             t.name as tool_name,
             t.asset_tag,
             DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as days_overdue,
             fn_hitung_denda(p.id) as estimated_denda
      FROM peminjaman p
      JOIN users u ON p.peminjam_id = u.id
      JOIN tools t ON p.tool_id = t.id
      WHERE p.status = 'dipinjam'
        AND p.tanggal_kembali_rencana < CURDATE()
      ORDER BY p.tanggal_kembali_rencana ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Get overdue error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const getDueSoon = async (req, res) => {
  try {
    const days = parseInt(req.query.days || '3');

    const [rows] = await pool.query(
      `
      SELECT p.*,
             u.name as peminjam_name,
             u.email as peminjam_email,
             t.name as tool_name,
             t.asset_tag,
             DATEDIFF(p.tanggal_kembali_rencana, CURDATE()) as days_until_due
      FROM peminjaman p
      JOIN users u ON p.peminjam_id = u.id
      JOIN tools t ON p.tool_id = t.id
      WHERE p.status = 'dipinjam'
        AND p.tanggal_kembali_rencana >= CURDATE()
        AND p.tanggal_kembali_rencana <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY p.tanggal_kembali_rencana ASC
    `,
      [days]
    );

    res.json(rows);
  } catch (error) {
    console.error('Get due soon error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const getUtilization = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [];

    if (start_date && end_date) {
      dateFilter = 'WHERE p.checkout_at BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    const [rows] = await pool.query(
      `
      SELECT t.id, t.name, t.asset_tag, c.name as category_name,
             COUNT(p.id) as borrow_count,
             COALESCE(SUM(DATEDIFF(COALESCE(p.tanggal_kembali_aktual, CURDATE()), p.tanggal_pinjam)), 0) as total_days_borrowed
      FROM tools t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN peminjaman p ON p.tool_id = t.id
      ${dateFilter}
      GROUP BY t.id
      ORDER BY borrow_count DESC
    `,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error('Get utilization error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const { action, entity_type, user_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT la.*, u.name as user_name
      FROM log_aktivitas la
      LEFT JOIN users u ON la.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      query += ' AND la.action = ?';
      params.push(action);
    }

    if (entity_type) {
      query += ' AND la.entity_type = ?';
      params.push(entity_type);
    }

    if (user_id) {
      query += ' AND la.user_id = ?';
      params.push(user_id);
    }

    const countQuery = query.replace('SELECT la.*, u.name as user_name', 'SELECT COUNT(*) as total');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0]?.total || 0;

    query += ' ORDER BY la.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await pool.query(query, params);

    res.json({
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

// Print-friendly report data (frontend will print)
const getPeminjamanReport = async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;

    let query = `
      SELECT p.*,
             u.name as peminjam_name,
             u.email as peminjam_email,
             t.name as tool_name,
             t.asset_tag,
             t.location,
             pg.tanggal_kembali as tanggal_pengembalian,
             pg.denda as denda_pengembalian
      FROM peminjaman p
      JOIN users u ON p.peminjam_id = u.id
      JOIN tools t ON p.tool_id = t.id
      LEFT JOIN pengembalian pg ON pg.peminjaman_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date && end_date) {
      query += ' AND p.tanggal_pinjam BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.created_at DESC';

    const [rows] = await pool.query(query, params);

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(', ');
      const [units] = await pool.query(
        `
          SELECT
            pu.peminjaman_id,
            tu.unit_code
          FROM peminjaman_units pu
          JOIN tool_units tu ON tu.id = pu.tool_unit_id
          WHERE pu.peminjaman_id IN (${placeholders})
          ORDER BY tu.unit_code ASC
        `,
        ids
      );

      const map = new Map();
      units.forEach((u) => {
        if (!map.has(u.peminjaman_id)) map.set(u.peminjaman_id, []);
        map.get(u.peminjaman_id).push(u.unit_code);
      });

      rows.forEach((row) => {
        row.unit_codes = map.get(row.id) || [];
      });
    }

    res.json(rows);
  } catch (error) {
    console.error('Get report peminjaman error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

module.exports = {
  getOverdue,
  getDueSoon,
  getUtilization,
  getDashboard,
  getAuditLogs,
  getPeminjamanReport,
};
