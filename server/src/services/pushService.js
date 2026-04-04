const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

const EVENT_LABELS = {
  INJURED: 'INJURED — Medical emergency',
  AMBUSH:  'AMBUSH — Contact reported',
  LINK_UP: 'LINK_UP — Rendezvous requested',
};

let vapidInitialized = false;

const initVapid = () => {
  if (vapidInitialized) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:admin@fox-eye.local',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  vapidInitialized = true;
  return true;
};

/**
 * Send a Web Push notification to all subscribed users who are in scope for
 * the given field event (same hierarchy logic as _emitToHierarchyScope).
 */
const sendPushForFieldEvent = async (event) => {
  if (!initVapid()) return;

  const { eventType, senderId, unitId, companyId, teamId, squadId } = event;

  const orClauses = [{ role: 'admin' }];
  if (senderId)   orClauses.push({ userId: senderId });
  if (squadId)    orClauses.push({ squadId });
  if (teamId)     orClauses.push({ teamId });
  if (companyId)  orClauses.push({ companyId });
  if (unitId)     orClauses.push({ unitId });

  const subscriptions = await PushSubscription.find({ $or: orClauses }).lean();
  if (!subscriptions.length) return;

  const payload = JSON.stringify({
    title: EVENT_LABELS[eventType] || 'Field Event',
    body:  'Tap to open Fox-Eye Field',
    eventId:   String(event._id),
    eventType,
  });

  const options = { urgency: eventType === 'LINK_UP' ? 'normal' : 'high' };

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, options)
    )
  );

  // Prune expired / invalid subscriptions (410 Gone, 404 Not Found)
  const expiredEndpoints = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const code = result.reason?.statusCode;
      if (code === 404 || code === 410) {
        expiredEndpoints.push(subscriptions[i].endpoint);
      }
    }
  });

  if (expiredEndpoints.length) {
    await PushSubscription.deleteMany({ endpoint: { $in: expiredEndpoints } });
  }
};

module.exports = { sendPushForFieldEvent };
