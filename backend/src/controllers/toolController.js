const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { auditLog } = require('../middlewares/audit');

const validateTool = [
  body('name').notEmpty().withMessage('Nama alat wajib diisi'),
  body('category_id').isInt().withMessage('Kategori wajib dipilih'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock minimal 0'),
  body('available_stock').optional().isInt({ min: 0 }).withMessage('Available stock minimal 0'),
];

const getAll = async (req, res) => {
  try {
    const { category_id, status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT t.*, c.name as category_name
      FROM tools t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ' AND t.category_id = ?';
      params.push(category_id);
    }

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (t.name LIKE ? OR t.asset_tag LIKE ? OR t.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Get total count
    const countQuery = query.replace('SELECT t.*, c.name as category_name', 'SELECT COUNT(*) as total');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Get paginated results
    query += ' ORDER BY t.name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [tools] = await pool.query(query, params);

    res.json({
      data: tools,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const getById = async (req, res) => {
  try {
    const [tools] = await pool.query(`
      SELECT t.*, c.name as category_name
      FROM tools t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (tools.length === 0) {
      return res.status(404).json({ error: 'Alat tidak ditemukan' });
    }

    res.json(tools[0]);
  } catch (error) {
    console.error('Get tool error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { category_id, name, asset_tag, description, location, status, photo_url, stock, available_stock } = req.body;

    if (asset_tag) {
      const [existing] = await pool.query('SELECT id FROM tools WHERE asset_tag = ?', [asset_tag]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Asset tag sudah digunakan' });
      }
    }

    const normalizedStock = stock === undefined || stock === null ? 1 : parseInt(stock);
    const normalizedAvailableStock =
      available_stock === undefined || available_stock === null ? normalizedStock : parseInt(available_stock);

    if (Number.isNaN(normalizedStock) || normalizedStock < 0) {
      return res.status(400).json({ error: 'Stock tidak valid' });
    }

    if (Number.isNaN(normalizedAvailableStock) || normalizedAvailableStock < 0 || normalizedAvailableStock > normalizedStock) {
      return res.status(400).json({ error: 'Available stock tidak valid' });
    }

    const computedStatus = normalizedAvailableStock > 0 ? 'available' : 'not_available';

    const [result] = await pool.query(
      `INSERT INTO tools (category_id, name, asset_tag, description, location, stock, available_stock, status, photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category_id,
        name,
        asset_tag || null,
        description || null,
        location || null,
        normalizedStock,
        normalizedAvailableStock,
        computedStatus,
        photo_url || null,
      ]
    );

    await auditLog(req.user.id, 'CREATE', 'tool', result.insertId, {
      name,
      asset_tag,
      stock: normalizedStock,
      available_stock: normalizedAvailableStock,
    });

    res.status(201).json({
      id: result.insertId,
      category_id,
      name,
      asset_tag,
      description,
      location,
      stock: normalizedStock,
      available_stock: normalizedAvailableStock,
      status: computedStatus,
      photo_url,
    });
  } catch (error) {
    console.error('Create tool error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { category_id, name, asset_tag, description, location, status, photo_url, stock, available_stock } = req.body;

    if (asset_tag) {
      const [existing] = await pool.query('SELECT id FROM tools WHERE asset_tag = ? AND id != ?', [asset_tag, req.params.id]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Asset tag sudah digunakan' });
      }
    }

    // Get existing tool to safely adjust stock
    const [existingToolRows] = await pool.query('SELECT stock, available_stock FROM tools WHERE id = ?', [req.params.id]);
    if (existingToolRows.length === 0) {
      return res.status(404).json({ error: 'Alat tidak ditemukan' });
    }

    const existingTool = existingToolRows[0];

    const normalizedStock = stock === undefined || stock === null ? existingTool.stock : parseInt(stock);
    const normalizedAvailableStock =
      available_stock === undefined || available_stock === null ? existingTool.available_stock : parseInt(available_stock);

    if (Number.isNaN(normalizedStock) || normalizedStock < 0) {
      return res.status(400).json({ error: 'Stock tidak valid' });
    }

    if (
      Number.isNaN(normalizedAvailableStock) ||
      normalizedAvailableStock < 0 ||
      normalizedAvailableStock > normalizedStock
    ) {
      return res.status(400).json({ error: 'Available stock tidak valid' });
    }

    const computedStatus = normalizedAvailableStock > 0 ? 'available' : 'not_available';

    const [result] = await pool.query(
      `UPDATE tools SET category_id = ?, name = ?, asset_tag = ?, description = ?, location = ?, stock = ?, available_stock = ?, status = ?, photo_url = ?
       WHERE id = ?`,
      [
        category_id,
        name,
        asset_tag || null,
        description || null,
        location || null,
        normalizedStock,
        normalizedAvailableStock,
        computedStatus,
        photo_url || null,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alat tidak ditemukan' });
    }

    await auditLog(req.user.id, 'UPDATE', 'tool', req.params.id, {
      name,
      status: computedStatus,
      stock: normalizedStock,
      available_stock: normalizedAvailableStock,
    });

    res.json({ message: 'Alat berhasil diperbarui' });
  } catch (error) {
    console.error('Update tool error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const remove = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM tools WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alat tidak ditemukan' });
    }

    await auditLog(req.user.id, 'DELETE', 'tool', req.params.id);

    res.json({ message: 'Alat berhasil dihapus' });
  } catch (error) {
    console.error('Delete tool error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['available', 'not_available'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    // Keep stock fields consistent when forcing status
    let availableStockUpdate = '';
    const params = [status];

    if (status === 'not_available') {
      availableStockUpdate = ', available_stock = 0';
    }

    const [result] = await pool.query(
      `UPDATE tools SET status = ?${availableStockUpdate} WHERE id = ?`,
      [...params, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alat tidak ditemukan' });
    }

    await auditLog(req.user.id, 'UPDATE_STATUS', 'tool', req.params.id, { status });

    res.json({ message: 'Status alat berhasil diperbarui' });
  } catch (error) {
    console.error('Update tool status error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

module.exports = {
  validateTool,
  getAll,
  getById,
  create,
  update,
  remove,
  updateStatus,
};
