const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { listViolations, getViolationById } = require('../controllers/violationsController');

router.get('/', auth, listViolations);
router.get('/:id', auth, getViolationById);

module.exports = router;
