const { body, validationResult } = require('express-validator');
const pool = require('../config/database');

const validatePeminjaman = [
  body('tool_id').isInt().withMessage('Tool ID wajib diisi'),
  body('qty').optional().isInt({ min: 1 }).withMessage('Jumlah minimal 1'),
  body('tanggal_pinjam').isDate().withMessage('Tanggal pinjam wajib diisi'),
  body('tanggal_kembali').isDate().withMessage('Tanggal kembali wajib diisi'),
];

const getAll = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*,
             u.name as peminjam_name,
             t.name as tool_name, t.asset_tag,
             ap.name as approved_by_name,
             co.name as checkout_by_name,
             rt.name as return_by_name
      FROM peminjaman p
      JOIN users u ON p.peminjam_id = u.id
      JOIN tools t ON p.tool_id = t.id
      LEFT JOIN users ap ON p.approved_by = ap.id
      LEFT JOIN users co ON p.checkout_by = co.id
      LEFT JOIN users rt ON p.return_by = rt.id
      WHERE 1=1
    `;
    const params = [];

    // Peminjam can only see their own requests
    if (req.user.role === 'peminjam') {
      query += ' AND p.peminjam_id = ?';
      params.push(req.user.id);
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    const countQuery = query.replace(
      /SELECT p\.\*[\s\S]*?FROM peminjaman/,
      'SELECT COUNT(*) as total FROM peminjaman'
    );
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0]?.total || 0;

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [peminjaman] = await pool.query(query, params);

    res.json({
      data: peminjaman,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get peminjaman error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const getById = async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT p.*,
             u.name as peminjam_name, u.email as peminjam_email,
             t.name as tool_name, t.asset_tag, t.description as tool_description,
             ap.name as approved_by_name,
             co.name as checkout_by_name,
             rt.name as return_by_name
      FROM peminjaman p
      JOIN users u ON p.peminjam_id = u.id
      JOIN tools t ON p.tool_id = t.id
      LEFT JOIN users ap ON p.approved_by = ap.id
      LEFT JOIN users co ON p.checkout_by = co.id
      LEFT JOIN users rt ON p.return_by = rt.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
    }

    const peminjaman = result[0];

    // Check permission for peminjam
    if (req.user.role === 'peminjam' && peminjaman.peminjam_id !== req.user.id) {
      return res.status(403).json({ error: 'Akses ditolak' });
    }

    // Get pengembalian if exists
    const [pengembalian] = await pool.query(
      'SELECT * FROM pengembalian WHERE peminjaman_id = ?',
      [req.params.id]
    );
    peminjaman.pengembalian = pengembalian[0] || null;

    res.json(peminjaman);
  } catch (error) {
    console.error('Get peminjaman error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { tool_id, qty = 1, tanggal_pinjam, tanggal_kembali, catatan } = req.body;

    // Validate dates
    if (new Date(tanggal_pinjam) > new Date(tanggal_kembali)) {
      return res.status(400).json({ error: 'Tanggal pinjam harus sebelum tanggal kembali' });
    }

    // Use stored procedure
    const [result] = await pool.query(
      'CALL sp_ajukan_peminjaman(?, ?, ?, ?, ?, ?)',
      [req.user.id, tool_id, qty, tanggal_pinjam, tanggal_kembali, catatan || null]
    );

    const spResult = result[0][0];

    if (spResult.status === 'error') {
      return res.status(400).json({ error: spResult.message });
    }

    res.status(201).json({
      id: spResult.peminjaman_id,
      message: spResult.message,
    });
  } catch (error) {
    console.error('Create peminjaman error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const approve = async (req, res) => {
  try {
    // Use stored procedure
    const [result] = await pool.query(
      'CALL sp_approve_peminjaman(?, ?)',
      [req.params.id, req.user.id]
    );

    const spResult = result[0][0];

    if (spResult.status === 'error') {
      return res.status(400).json({ error: spResult.message });
    }

    res.json({ message: spResult.message });
  } catch (error) {
    console.error('Approve peminjaman error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const reject = async (req, res) => {
  try {
    const { alasan } = req.body;

    const [check] = await pool.query(
      'SELECT status FROM peminjaman WHERE id = ?',
      [req.params.id]
    );

    if (check.length === 0) {
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
    }

    if (check[0].status !== 'pending') {
      return res.status(400).json({ error: 'Status peminjaman tidak valid' });
    }

    await pool.query(
      'UPDATE peminjaman SET status = ?, catatan = CONCAT(IFNULL(catatan, ""), ?) WHERE id = ?',
      ['rejected', '\n[Ditolak] ' + (alasan || 'Tidak ada alasan'), req.params.id]
    );

    res.json({ message: 'Peminjaman ditolak' });
  } catch (error) {
    console.error('Reject peminjaman error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const checkout = async (req, res) => {
  try {
    const { kondisi } = req.body;

    // Use stored procedure
    const [result] = await pool.query(
      'CALL sp_checkout_peminjaman(?, ?, ?)',
      [req.params.id, req.user.id, kondisi || 'Baik']
    );

    const spResult = result[0][0];

    if (spResult.status === 'error') {
      return res.status(400).json({ error: spResult.message });
    }

    res.json({ message: spResult.message });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const returnItem = async (req, res) => {
  try {
    const { kondisi, keterangan } = req.body;

    // Use stored procedure
    const [result] = await pool.query(
      'CALL sp_kembalikan_alat(?, ?, ?, ?)',
      [req.params.id, req.user.id, kondisi || 'Baik', keterangan || null]
    );

    const spResult = result[0][0];

    if (spResult.status === 'error') {
      return res.status(400).json({ error: spResult.message });
    }

    res.json({
      message: spResult.message,
      denda: spResult.denda,
      hari_telat: spResult.hari_telat
    });
  } catch (error) {
    console.error('Return error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const calculateDenda = async (req, res) => {
  try {
    const [result] = await pool.query(
      'SELECT fn_hitung_denda(?) as denda',
      [req.params.id]
    );

    res.json({ denda: result[0].denda });
  } catch (error) {
    console.error('Calculate denda error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

module.exports = {
  validatePeminjaman,
  getAll,
  getById,
  create,
  approve,
  reject,
  checkout,
  returnItem,
  calculateDenda,
};
