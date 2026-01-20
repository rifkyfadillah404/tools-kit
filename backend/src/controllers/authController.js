const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const config = require('../config');

const validateLogin = [
  body('email').isEmail().withMessage('Email tidak valid'),
  body('password').notEmpty().withMessage('Password wajib diisi'),
];

const validateRegister = [
  body('name').notEmpty().withMessage('Nama wajib diisi'),
  body('email').isEmail().withMessage('Email tidak valid'),
  body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
  body('role')
    .optional()
    .isIn(['admin', 'petugas', 'peminjam'])
    .withMessage('Role tidak valid'),
];

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password, role } = req.body;

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email sudah terdaftar' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role || 'peminjam']
    );

    const token = jwt.sign({ id: result.insertId, role: role || 'peminjam' }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.status(201).json({
      token,
      user: {
        id: result.insertId,
        name,
        email,
        role: role || 'peminjam',
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

const me = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = {
  validateLogin,
  validateRegister,
  login,
  register,
  me,
};
