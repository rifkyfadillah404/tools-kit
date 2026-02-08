const express = require('express');
const router = express.Router();
const toolController = require('../controllers/toolController');
const { auth, authorize } = require('../middlewares/auth');
const { uploadToolPhoto } = require('../middlewares/upload');

router.get('/', auth, toolController.getAll);
router.get('/:id', auth, toolController.getById);

router.post(
  '/upload',
  auth,
  authorize('admin', 'petugas'),
  uploadToolPhoto.single('photo'),
  toolController.uploadPhoto
);

router.post('/', auth, authorize('admin'), toolController.validateTool, toolController.create);
router.put('/:id', auth, authorize('admin'), toolController.validateTool, toolController.update);
router.patch('/:id/status', auth, authorize('admin'), toolController.updateStatus);
router.delete('/:id', auth, authorize('admin'), toolController.remove);

router.get('/:id/units', auth, toolController.getUnits);
router.post('/:id/units', auth, authorize('admin'), toolController.validateUnitPayload, toolController.addUnits);
router.patch('/:id/units/:unitId', auth, authorize('admin', 'petugas'), toolController.validateUnitPayload, toolController.updateUnit);
router.delete('/:id/units/:unitId', auth, authorize('admin'), toolController.removeUnit);

module.exports = router;
