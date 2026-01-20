const jwt = require('jsonwebtoken');
const config = require('../config');
const pool = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token tidak ditemukan' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const [users] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [decoded.id]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'User tidak ditemukan' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token tidak valid' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Tidak terautentikasi' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak' });
    }
    next();
  };
};

module.exports = { auth, authorize };
