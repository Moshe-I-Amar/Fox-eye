const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const PushSubscription = require('../models/PushSubscription');

// GET /api/push/vapid-public-key  (public — client needs this to subscribe)
const getVapidPublicKey = asyncHandler(async (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) throw new AppError('PUSH_NOT_CONFIGURED', 'Push notifications not configured on this server', 503);
  res.json({ success: true, data: { vapidPublicKey: key } });
});

// POST /api/push/subscribe  (auth required)
const subscribe = asyncHandler(async (req, res) => {
  const { subscription } = req.body;
  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    throw new AppError('VALIDATION_ERROR', 'Invalid push subscription object', 400);
  }

  const user = req.userDoc;

  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      userId:    user._id,
      endpoint:  subscription.endpoint,
      keys:      { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      role:      user.role,
      unitId:    user.unitId    || null,
      companyId: user.companyId || null,
      teamId:    user.teamId    || null,
      squadId:   user.squadId   || null,
    },
    { upsert: true, new: true }
  );

  res.json({ success: true, data: { subscribed: true } });
});

// DELETE /api/push/subscribe  (auth required)
const unsubscribe = asyncHandler(async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) throw new AppError('VALIDATION_ERROR', 'endpoint is required', 400);

  await PushSubscription.deleteOne({ endpoint, userId: req.user.id });

  res.json({ success: true, data: { unsubscribed: true } });
});

// POST /api/push/subscribe/mobile  (auth required — Expo Go clients)
const subscribeMobile = asyncHandler(async (req, res) => {
  const { expoToken } = req.body;
  if (!expoToken || typeof expoToken !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'expoToken is required', 400);
  }

  const user = req.userDoc;

  await PushSubscription.findOneAndUpdate(
    { expoToken },
    {
      userId:    user._id,
      platform:  'expo',
      expoToken,
      role:      user.role,
      unitId:    user.unitId    || null,
      companyId: user.companyId || null,
      teamId:    user.teamId    || null,
      squadId:   user.squadId   || null,
    },
    { upsert: true, new: true }
  );

  res.json({ success: true, data: { subscribed: true } });
});

module.exports = { getVapidPublicKey, subscribe, unsubscribe, subscribeMobile };
