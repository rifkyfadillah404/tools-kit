const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { auth, authorize } = require('../middlewares/auth');

router.get('/', auth, categoryController.getAll);
router.get('/:id', auth, categoryController.getById);
router.post('/', auth, authorize('admin'), categoryController.validateCategory, categoryController.create);
router.put('/:id', auth, authorize('admin'), categoryController.validateCategory, categoryController.update);
router.delete('/:id', auth, authorize('admin'), categoryController.remove);

module.exports = router;
