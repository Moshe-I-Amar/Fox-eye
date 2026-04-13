const https = require('https');
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
 * POST JSON to the Expo Push API. Returns the parsed response body.
 */
const expoPost = (body) =>
  new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'exp.host',
        path: '/--/api/v2/push/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });

/**
 * Send Expo push notifications to a set of expo-platform subscriptions.
 * Prunes DeviceNotRegistered tokens automatically.
 */
const sendExpoNotifications = async (subscriptions, { title, body, data = {}, priority = 'high' }) => {
  if (!subscriptions.length) return;

  // Expo limits 100 messages per request
  const BATCH_SIZE = 100;
  const expiredTokens = [];

  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    const messages = batch.map((sub) => ({
      to:       sub.expoToken,
      title,
      body,
      data,
      priority,
      sound:    'default',
    }));

    let response;
    try {
      response = await expoPost(messages);
    } catch (err) {
      console.warn('[pushService] Expo API request failed:', err.message);
      continue;
    }

    // response.data is an array of tickets parallel to messages
    const tickets = response?.data || [];
    tickets.forEach((ticket, idx) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        expiredTokens.push(batch[idx].expoToken);
      }
    });
  }

  if (expiredTokens.length) {
    await PushSubscription.deleteMany({ expoToken: { $in: expiredTokens } });
  }
};

/**
 * Send a Web Push notification to all subscribed users who are in scope for
 * the given field event (same hierarchy logic as _emitToHierarchyScope).
 * Also fans out to Expo (mobile) subscribers in the same scope.
 */
const sendPushForFieldEvent = async (event) => {
  const { eventType, senderId, unitId, companyId, teamId, squadId } = event;

  const orClauses = [{ role: 'admin' }];
  if (senderId)   orClauses.push({ userId: senderId });
  if (squadId)    orClauses.push({ squadId });
  if (teamId)     orClauses.push({ teamId });
  if (companyId)  orClauses.push({ companyId });
  if (unitId)     orClauses.push({ unitId });

  const subscriptions = await PushSubscription.find({ $or: orClauses }).lean();
  if (!subscriptions.length) return;

  const webSubs  = subscriptions.filter((s) => s.platform !== 'expo');
  const expoSubs = subscriptions.filter((s) => s.platform === 'expo');

  const notifTitle = EVENT_LABELS[eventType] || 'Field Event';
  const notifBody  = 'Tap to open Fox-Eye Field';
  const urgency    = eventType === 'LINK_UP' ? 'normal' : 'high';

  const tasks = [];

  // VAPID path (web)
  if (webSubs.length && initVapid()) {
    const payload = JSON.stringify({
      title: notifTitle,
      body:  notifBody,
      eventId:   String(event._id),
      eventType,
    });

    const vapidTask = Promise.allSettled(
      webSubs.map((sub) =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { urgency })
      )
    ).then((results) => {
      const expiredEndpoints = [];
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          const code = result.reason?.statusCode;
          if (code === 404 || code === 410) expiredEndpoints.push(webSubs[i].endpoint);
        }
      });
      if (expiredEndpoints.length) {
        return PushSubscription.deleteMany({ endpoint: { $in: expiredEndpoints } });
      }
    });

    tasks.push(vapidTask);
  }

  // Expo path (mobile)
  if (expoSubs.length) {
    tasks.push(
      sendExpoNotifications(expoSubs, {
        title:    notifTitle,
        body:     notifBody,
        data:     { eventId: String(event._id), eventType },
        priority: urgency === 'high' ? 'high' : 'normal',
      })
    );
  }

  await Promise.allSettled(tasks);
};

/**
 * Send a high-urgency push notification to all users within the
 * mobilization's targetScope. Fans out to both web (VAPID) and mobile (Expo).
 */
const sendPushForMobilization = async (mob) => {
  const { targetScope, incidentDescription } = mob;

  const scopeFilter = { unitId: targetScope.unitId };
  if (targetScope.companyId) scopeFilter.companyId = targetScope.companyId;
  if (targetScope.teamId)    scopeFilter.teamId    = targetScope.teamId;

  const subscriptions = await PushSubscription.find({
    $or: [{ role: 'admin' }, scopeFilter]
  }).lean();

  if (!subscriptions.length) return;

  const webSubs  = subscriptions.filter((s) => s.platform !== 'expo');
  const expoSubs = subscriptions.filter((s) => s.platform === 'expo');

  const notifTitle = '⚠ MOBILIZATION ORDER';
  const notifBody  = incidentDescription || 'Immediate mobilization — report to rally point';

  const tasks = [];

  // VAPID path (web)
  if (webSubs.length && initVapid()) {
    const payload = JSON.stringify({
      title:          notifTitle,
      body:           notifBody,
      mobilizationId: String(mob._id),
      type:           'MOBILIZATION',
    });

    const vapidTask = Promise.allSettled(
      webSubs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
          { urgency: 'high' }
        )
      )
    ).then((results) => {
      const expiredEndpoints = [];
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          const code = result.reason?.statusCode;
          if (code === 404 || code === 410) expiredEndpoints.push(webSubs[i].endpoint);
        }
      });
      if (expiredEndpoints.length) {
        return PushSubscription.deleteMany({ endpoint: { $in: expiredEndpoints } });
      }
    });

    tasks.push(vapidTask);
  }

  // Expo path (mobile)
  if (expoSubs.length) {
    tasks.push(
      sendExpoNotifications(expoSubs, {
        title:    notifTitle,
        body:     notifBody,
        data:     { mobilizationId: String(mob._id), type: 'MOBILIZATION' },
        priority: 'high',
      })
    );
  }

  await Promise.allSettled(tasks);
};

module.exports = { sendPushForFieldEvent, sendPushForMobilization };
