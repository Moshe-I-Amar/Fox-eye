'use strict';

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { validateMobilizationCreate, validateMobilizationAdvance } = require('../utils/validators');
const {
  triggerMobilization,
  getActive,
  advanceStatus,
  standDown
} = require('../controllers/mobilizationController');

// All mobilization endpoints require authentication
router.get('/active', auth, getActive);
router.post('/',      auth, validateMobilizationCreate, triggerMobilization);
router.patch('/:id/status',     auth, validateMobilizationAdvance, advanceStatus);
router.patch('/:id/stand-down', auth, standDown);

module.exports = router;
