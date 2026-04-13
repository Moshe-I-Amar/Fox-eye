const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getVapidPublicKey, subscribe, unsubscribe, subscribeMobile } = require('../controllers/pushController');

router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe',        auth, subscribe);
router.post('/subscribe/mobile', auth, subscribeMobile);
router.delete('/subscribe',      auth, unsubscribe);

module.exports = router;
