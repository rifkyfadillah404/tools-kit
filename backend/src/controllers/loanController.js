const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { auditLog } = require('../middlewares/audit');

const getAll = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT l.*, lr.purpose, u.name as requester_name,
             admin.name as checked_out_by_name
      FROM loans l
      JOIN loan_requests lr ON l.request_id = lr.id
      JOIN users u ON lr.requester_id = u.id
      LEFT JOIN users admin ON l.checked_out_by = admin.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND l.status = ?';
      params.push(status);
    }

    const countQuery = query.replace(
      'SELECT l.*, lr.purpose, u.name as requester_name, admin.name as checked_out_by_name',
      'SELECT COUNT(*) as total'
    );
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [loans] = await pool.query(query, params);

    // Get items for each loan
    for (const loan of loans) {
      const [items] = await pool.query(`
        SELECT li.*, t.name as tool_name, t.asset_tag
        FROM loan_items li
        JOIN tools t ON li.tool_id = t.id
        WHERE li.loan_id = ?
      `, [loan.id]);
      loan.items = items;
    }

    res.json({
      data: loans,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get loans error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const getById = async (req, res) => {
  try {
    const [loans] = await pool.query(`
      SELECT l.*, lr.purpose, lr.notes, lr.start_date, lr.end_date,
             u.name as requester_name, admin.name as checked_out_by_name
      FROM loans l
      JOIN loan_requests lr ON l.request_id = lr.id
      JOIN users u ON lr.requester_id = u.id
      LEFT JOIN users admin ON l.checked_out_by = admin.id
      WHERE l.id = ?
    `, [req.params.id]);

    if (loans.length === 0) {
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
    }

    const loan = loans[0];

    const [items] = await pool.query(`
      SELECT li.*, t.name as tool_name, t.asset_tag
      FROM loan_items li
      JOIN tools t ON li.tool_id = t.id
      WHERE li.loan_id = ?
    `, [req.params.id]);
    loan.items = items;

    res.json(loan);
  } catch (error) {
    console.error('Get loan error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const checkout = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { request_id, conditions } = req.body;

    // Get approved request
    const [requests] = await connection.query(
      'SELECT * FROM loan_requests WHERE id = ? AND status = ?',
      [request_id, 'approved']
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Permintaan tidak ditemukan atau belum disetujui' });
    }

    const request = requests[0];

    // Check if loan already exists
    const [existingLoans] = await connection.query(
      'SELECT id FROM loans WHERE request_id = ?',
      [request_id]
    );

    if (existingLoans.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Peminjaman sudah dilakukan sebelumnya' });
    }

    // Create loan
    const [loanResult] = await connection.query(
      `INSERT INTO loans (request_id, checked_out_by, checked_out_at, due_at, status)
       VALUES (?, ?, NOW(), ?, 'active')`,
      [request_id, req.user.id, request.end_date]
    );

    // Get request items
    const [requestItems] = await connection.query(
      'SELECT * FROM loan_request_items WHERE request_id = ?',
      [request_id]
    );

    // Create loan items and update tool status
    for (const item of requestItems) {
      const conditionOut = conditions?.[item.tool_id] || 'Baik';

      await connection.query(
        'INSERT INTO loan_items (loan_id, tool_id, qty, condition_out) VALUES (?, ?, ?, ?)',
        [loanResult.insertId, item.tool_id, item.qty, conditionOut]
      );

      await connection.query(
        'UPDATE tools SET status = ? WHERE id = ?',
        ['checked_out', item.tool_id]
      );
    }

    await connection.commit();

    await auditLog(req.user.id, 'CHECKOUT', 'loan', loanResult.insertId, { request_id });

    res.status(201).json({
      id: loanResult.insertId,
      message: 'Checkout berhasil',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  } finally {
    connection.release();
  }
};

const returnLoan = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { conditions } = req.body;

    const [loans] = await connection.query(
      'SELECT * FROM loans WHERE id = ? AND status = ?',
      [req.params.id, 'active']
    );

    if (loans.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan atau sudah dikembalikan' });
    }

    // Update loan
    await connection.query(
      'UPDATE loans SET returned_at = NOW(), status = ? WHERE id = ?',
      ['returned', req.params.id]
    );

    // Get loan items
    const [items] = await connection.query(
      'SELECT * FROM loan_items WHERE loan_id = ?',
      [req.params.id]
    );

    // Update items and tool status
    for (const item of items) {
      const conditionIn = conditions?.[item.tool_id] || 'Baik';

      await connection.query(
        'UPDATE loan_items SET condition_in = ? WHERE id = ?',
        [conditionIn, item.id]
      );

      await connection.query(
        'UPDATE tools SET status = ? WHERE id = ?',
        ['available', item.tool_id]
      );
    }

    await connection.commit();

    await auditLog(req.user.id, 'RETURN', 'loan', req.params.id);

    res.json({ message: 'Pengembalian berhasil' });
  } catch (error) {
    await connection.rollback();
    console.error('Return loan error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  } finally {
    connection.release();
  }
};

module.exports = {
  getAll,
  getById,
  checkout,
  returnLoan,
};

// Deprecated controller.
// UKK version uses peminjamanController and /api/peminjaman.

