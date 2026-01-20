const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { auditLog } = require('../middlewares/audit');

const validateCategory = [
  body('name').notEmpty().withMessage('Nama kategori wajib diisi'),
];

const getAll = async (req, res) => {
  try {
    const [categories] = await pool.query(`
      SELECT c.*, COUNT(t.id) as tool_count
      FROM categories c
      LEFT JOIN tools t ON c.id = t.category_id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const getById = async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (categories.length === 0) {
      return res.status(404).json({ error: 'Kategori tidak ditemukan' });
    }
    res.json(categories[0]);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, description } = req.body;
    const [result] = await pool.query(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description || null]
    );

    await auditLog(req.user.id, 'CREATE', 'category', result.insertId, { name });

    res.status(201).json({
      id: result.insertId,
      name,
      description,
      is_active: true,
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, description, is_active } = req.body;
    const [result] = await pool.query(
      'UPDATE categories SET name = ?, description = ?, is_active = ? WHERE id = ?',
      [name, description || null, is_active !== false, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kategori tidak ditemukan' });
    }

    await auditLog(req.user.id, 'UPDATE', 'category', req.params.id, { name });

    res.json({ message: 'Kategori berhasil diperbarui' });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const remove = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kategori tidak ditemukan' });
    }

    await auditLog(req.user.id, 'DELETE', 'category', req.params.id);

    res.json({ message: 'Kategori berhasil dihapus' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

module.exports = {
  validateCategory,
  getAll,
  getById,
  create,
  update,
  remove,
};
