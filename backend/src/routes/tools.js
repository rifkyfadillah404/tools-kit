const express = require('express');
const router = express.Router();
const toolController = require('../controllers/toolController');
const { auth, authorize } = require('../middlewares/auth');

router.get('/', auth, toolController.getAll);
router.get('/:id', auth, toolController.getById);
router.post('/', auth, authorize('admin'), toolController.validateTool, toolController.create);
router.put('/:id', auth, authorize('admin'), toolController.validateTool, toolController.update);
router.patch('/:id/status', auth, authorize('admin'), toolController.updateStatus);
router.delete('/:id', auth, authorize('admin'), toolController.remove);

module.exports = router;
