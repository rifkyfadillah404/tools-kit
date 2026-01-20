const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const categoryRoutes = require('./categories');
const toolRoutes = require('./tools');
const peminjamanRoutes = require('./peminjaman');
const reportRoutes = require('./reports');

router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/tools', toolRoutes);
router.use('/peminjaman', peminjamanRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
