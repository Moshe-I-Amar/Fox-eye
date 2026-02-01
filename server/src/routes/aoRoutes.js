const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  validateAOCreate,
  validateAOUpdate,
  validateAOActive
} = require('../utils/validators');
const {
  listAOs,
  createAO,
  updateAO,
  setAOActive,
  deleteAO
} = require('../controllers/aoController');

router.get('/', auth, listAOs);
router.post('/', auth, validateAOCreate, createAO);
router.put('/:id', auth, validateAOUpdate, updateAO);
router.patch('/:id/active', auth, validateAOActive, setAOActive);
router.delete('/:id', auth, deleteAO);

module.exports = router;
