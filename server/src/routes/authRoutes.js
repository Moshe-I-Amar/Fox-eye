const express = require('express');
const router = express.Router();
const { validateRegister, validateLogin } = require('../utils/validators');
const { auth } = require('../middleware/auth');
const { register, login, getMe } = require('../controllers/authController');

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', auth, getMe);

module.exports = router;
