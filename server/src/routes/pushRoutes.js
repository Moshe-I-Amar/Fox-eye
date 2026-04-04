const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getVapidPublicKey, subscribe, unsubscribe } = require('../controllers/pushController');

router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe',   auth, subscribe);
router.delete('/subscribe', auth, unsubscribe);

module.exports = router;
