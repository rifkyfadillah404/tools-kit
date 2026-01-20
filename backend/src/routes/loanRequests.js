const express = require('express');
const router = express.Router();

// Deprecated route file.
// UKK version uses /api/peminjaman and stored procedures.
router.use((req, res) => {
  res.status(410).json({
    error: 'Endpoint deprecated. Use /api/peminjaman',
  });
});

module.exports = router;
