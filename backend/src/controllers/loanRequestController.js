const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { auditLog } = require('../middlewares/audit');

const validateRequest = [
  body('start_date').isDate().withMessage('Tanggal mulai wajib diisi'),
  body('end_date').isDate().withMessage('Tanggal selesai wajib diisi'),
  body('items').isArray({ min: 1 }).withMessage('Minimal pilih 1 alat'),
];

const getAll = async (req, res) => {
  try {
    const { status, requester_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT lr.*, u.name as requester_name
      FROM loan_requests lr
      JOIN users u ON lr.requester_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Borrower can only see their own requests
    if (req.user.role === 'borrower') {
      query += ' AND lr.requester_id = ?';
      params.push(req.user.id);
    } else if (requester_id) {
      query += ' AND lr.requester_id = ?';
      params.push(requester_id);
    }

    if (status) {
      query += ' AND lr.status = ?';
      params.push(status);
    }

    const countQuery = query.replace('SELECT lr.*, u.name as requester_name', 'SELECT COUNT(*) as total');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY lr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [requests] = await pool.query(query, params);

    // Get items for each request
    for (const request of requests) {
      const [items] = await pool.query(`
        SELECT lri.*, t.name as tool_name, t.asset_tag
        FROM loan_request_items lri
        JOIN tools t ON lri.tool_id = t.id
        WHERE lri.request_id = ?
      `, [request.id]);
      request.items = items;
    }

    res.json({
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get loan requests error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const getById = async (req, res) => {
  try {
    const [requests] = await pool.query(`
      SELECT lr.*, u.name as requester_name
      FROM loan_requests lr
      JOIN users u ON lr.requester_id = u.id
      WHERE lr.id = ?
    `, [req.params.id]);

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Permintaan tidak ditemukan' });
    }

    const request = requests[0];

    // Check permission
    if (req.user.role === 'borrower' && request.requester_id !== req.user.id) {
      return res.status(403).json({ error: 'Akses ditolak' });
    }

    // Get items
    const [items] = await pool.query(`
      SELECT lri.*, t.name as tool_name, t.asset_tag, t.status as tool_status
      FROM loan_request_items lri
      JOIN tools t ON lri.tool_id = t.id
      WHERE lri.request_id = ?
    `, [req.params.id]);
    request.items = items;

    // Get approval if exists
    const [approvals] = await pool.query(`
      SELECT a.*, u.name as approver_name
      FROM approvals a
      JOIN users u ON a.approver_id = u.id
      WHERE a.request_id = ?
    `, [req.params.id]);
    request.approval = approvals[0] || null;

    res.json(request);
  } catch (error) {
    console.error('Get loan request error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { start_date, end_date, purpose, notes, items } = req.body;

    // Validate dates
    if (new Date(start_date) > new Date(end_date)) {
      await connection.rollback();
      return res.status(400).json({ error: 'Tanggal mulai harus sebelum tanggal selesai' });
    }

    // Check tool availability
    for (const item of items) {
      const [tools] = await connection.query(
        'SELECT id, name, status FROM tools WHERE id = ?',
        [item.tool_id]
      );

      if (tools.length === 0) {
        await connection.rollback();
        return res.status(400).json({ error: `Alat dengan ID ${item.tool_id} tidak ditemukan` });
      }

      if (['maintenance', 'retired'].includes(tools[0].status)) {
        await connection.rollback();
        return res.status(400).json({ error: `Alat "${tools[0].name}" tidak tersedia untuk dipinjam` });
      }

      // Check for conflicts
      const [conflicts] = await connection.query(`
        SELECT lr.id FROM loan_requests lr
        JOIN loan_request_items lri ON lr.id = lri.request_id
        WHERE lri.tool_id = ?
        AND lr.status IN ('pending', 'approved')
        AND lr.start_date <= ? AND lr.end_date >= ?
      `, [item.tool_id, end_date, start_date]);

      if (conflicts.length > 0) {
        await connection.rollback();
        return res.status(400).json({ error: `Alat "${tools[0].name}" sudah dipesan pada tanggal tersebut` });
      }
    }

    // Create request
    const [result] = await connection.query(
      `INSERT INTO loan_requests (requester_id, start_date, end_date, purpose, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, start_date, end_date, purpose || null, notes || null]
    );

    // Create request items
    for (const item of items) {
      await connection.query(
        'INSERT INTO loan_request_items (request_id, tool_id, qty) VALUES (?, ?, ?)',
        [result.insertId, item.tool_id, item.qty || 1]
      );
    }

    await connection.commit();

    await auditLog(req.user.id, 'CREATE', 'loan_request', result.insertId, { items: items.length });

    res.status(201).json({
      id: result.insertId,
      message: 'Permintaan peminjaman berhasil dibuat',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create loan request error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  } finally {
    connection.release();
  }
};

const approve = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [requests] = await connection.query(
      'SELECT * FROM loan_requests WHERE id = ? AND status = ?',
      [req.params.id, 'pending']
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Permintaan tidak ditemukan atau sudah diproses' });
    }

    // Update request status
    await connection.query(
      'UPDATE loan_requests SET status = ? WHERE id = ?',
      ['approved', req.params.id]
    );

    // Create approval record
    await connection.query(
      'INSERT INTO approvals (request_id, approver_id, decision, reason) VALUES (?, ?, ?, ?)',
      [req.params.id, req.user.id, 'approved', req.body.reason || null]
    );

    // Update tool status to reserved
    const [items] = await connection.query(
      'SELECT tool_id FROM loan_request_items WHERE request_id = ?',
      [req.params.id]
    );

    for (const item of items) {
      await connection.query(
        'UPDATE tools SET status = ? WHERE id = ? AND status = ?',
        ['reserved', item.tool_id, 'available']
      );
    }

    await connection.commit();

    await auditLog(req.user.id, 'APPROVE', 'loan_request', req.params.id);

    res.json({ message: 'Permintaan peminjaman disetujui' });
  } catch (error) {
    await connection.rollback();
    console.error('Approve loan request error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  } finally {
    connection.release();
  }
};

const decline = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Alasan penolakan wajib diisi' });
    }

    const [requests] = await connection.query(
      'SELECT * FROM loan_requests WHERE id = ? AND status = ?',
      [req.params.id, 'pending']
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Permintaan tidak ditemukan atau sudah diproses' });
    }

    await connection.query(
      'UPDATE loan_requests SET status = ? WHERE id = ?',
      ['declined', req.params.id]
    );

    await connection.query(
      'INSERT INTO approvals (request_id, approver_id, decision, reason) VALUES (?, ?, ?, ?)',
      [req.params.id, req.user.id, 'declined', reason]
    );

    await connection.commit();

    await auditLog(req.user.id, 'DECLINE', 'loan_request', req.params.id, { reason });

    res.json({ message: 'Permintaan peminjaman ditolak' });
  } catch (error) {
    await connection.rollback();
    console.error('Decline loan request error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  } finally {
    connection.release();
  }
};

const cancel = async (req, res) => {
  try {
    const [requests] = await pool.query(
      'SELECT * FROM loan_requests WHERE id = ? AND requester_id = ? AND status = ?',
      [req.params.id, req.user.id, 'pending']
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Permintaan tidak ditemukan atau tidak bisa dibatalkan' });
    }

    await pool.query('UPDATE loan_requests SET status = ? WHERE id = ?', ['cancelled', req.params.id]);

    await auditLog(req.user.id, 'CANCEL', 'loan_request', req.params.id);

    res.json({ message: 'Permintaan peminjaman dibatalkan' });
  } catch (error) {
    console.error('Cancel loan request error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

module.exports = {
  validateRequest,
  getAll,
  getById,
  create,
  approve,
  decline,
  cancel,
};

// Deprecated controller.
// UKK version uses peminjamanController and /api/peminjaman.

