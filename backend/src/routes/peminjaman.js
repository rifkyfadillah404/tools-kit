const express = require('express');
const router = express.Router();
const peminjamanController = require('../controllers/peminjamanController');
const { auth, authorize } = require('../middlewares/auth');

// List + detail
router.get('/', auth, peminjamanController.getAll);
router.get('/:id', auth, peminjamanController.getById);

// Peminjam submits request
router.post(
  '/',
  auth,
  authorize('peminjam', 'admin'),
  peminjamanController.validatePeminjaman,
  peminjamanController.create
);

// Petugas/Admin workflow actions
router.post('/:id/approve', auth, authorize('petugas', 'admin'), peminjamanController.approve);
router.post('/:id/reject', auth, authorize('petugas', 'admin'), peminjamanController.reject);
router.post('/:id/checkout', auth, authorize('petugas', 'admin'), peminjamanController.checkout);
router.post('/:id/return', auth, authorize('petugas', 'admin'), peminjamanController.returnItem);

// Utility: calculate fine without returning
router.get('/:id/denda', auth, authorize('petugas', 'admin'), peminjamanController.calculateDenda);

module.exports = router;
