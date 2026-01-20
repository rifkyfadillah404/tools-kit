const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth, authorize } = require('../middlewares/auth');

router.get('/dashboard', auth, authorize('admin', 'petugas'), reportController.getDashboard);
router.get('/overdue', auth, authorize('admin', 'petugas'), reportController.getOverdue);
router.get('/due-soon', auth, authorize('admin', 'petugas'), reportController.getDueSoon);
router.get('/utilization', auth, authorize('admin', 'petugas'), reportController.getUtilization);
router.get('/audit-logs', auth, authorize('admin', 'petugas'), reportController.getAuditLogs);
router.get('/peminjaman', auth, authorize('admin', 'petugas'), reportController.getPeminjamanReport);

module.exports = router;
