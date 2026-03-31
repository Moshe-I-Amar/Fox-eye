const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { validateFieldEventCreate } = require('../utils/validators');
const {
  createEvent,
  listEvents,
  acknowledgeEvent,
  resolveEvent
} = require('../controllers/eventController');

// 10 field events per hour per user — prevents panic button flooding
const eventPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req.user && req.user.id) ? req.user.id : req.ip,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Field event rate limit exceeded (10/hour)' }
  }
});

router.get('/',  auth, listEvents);
router.post('/', auth, eventPostLimiter, validateFieldEventCreate, createEvent);
router.patch('/:id/acknowledge', auth, acknowledgeEvent);
router.patch('/:id/resolve',     auth, resolveEvent);

module.exports = router;
