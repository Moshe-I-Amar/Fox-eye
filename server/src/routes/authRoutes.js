const express = require('express');
const router = express.Router();
const { validateRegister, validateLogin } = require('../utils/validators');
const { auth } = require('../middleware/auth');
const { register, login, getMe, logout } = require('../controllers/authController');
const { validateInviteToken } = require('../controllers/inviteController');

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/logout', logout);
router.get('/me', auth, getMe);
router.get('/invite/:token', validateInviteToken);

module.exports = router;
