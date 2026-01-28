const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  validateAOCreate,
  validateAOUpdate,
  validateAOActive
} = require('../utils/validators');
const {
  createAO,
  updateAO,
  setAOActive
} = require('../controllers/aoController');

router.post('/', auth, validateAOCreate, createAO);
router.put('/:id', auth, validateAOUpdate, updateAO);
router.patch('/:id/active', auth, validateAOActive, setAOActive);

module.exports = router;
