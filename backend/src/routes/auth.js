const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middlewares/auth');

router.post('/login', authController.validateLogin, authController.login);
router.post('/register', authController.validateRegister, authController.register);
router.get('/me', auth, authController.me);

module.exports = router;
