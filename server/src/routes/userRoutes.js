const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const { validateLocation } = require('../utils/validators');
const {
  getAllUsers,
  getUserById,
  getUsersNearby,
  updateMyLocation
} = require('../controllers/usersController');

router.get('/', auth, role(['admin']), getAllUsers);
router.get('/near', auth, getUsersNearby);
router.get('/:id', auth, role(['admin']), getUserById);
router.put('/me/location', auth, validateLocation, updateMyLocation);

module.exports = router;