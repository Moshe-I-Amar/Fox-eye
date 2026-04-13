'use strict';

const asyncHandler = require('../utils/asyncHandler');
const {
  createMobilization,
  getActiveMobilization,
  advanceMobilizationStatus,
  standDownMobilization
} = require('../services/mobilizationService');
const { sendPushForMobilization } = require('../services/pushService');
const { getSocketService } = require('../realtime/socket');

/**
 * POST /api/mobilization
 * Trigger a new mobilization. Requires TEAM_COMMANDER rank or above.
 */
exports.triggerMobilization = asyncHandler(async (req, res) => {
  const { targetScope, incidentDescription, rallyPoint, rallyPointName } = req.body;

  const mob = await createMobilization({
    actor: req.user,
    targetScope,
    incidentDescription,
    rallyPoint,
    rallyPointName
  });

  // Socket broadcast — non-blocking; failure does not roll back the DB write
  try {
    getSocketService().broadcastMobilizationActivated(mob);
  } catch (err) {
    console.warn('[mobilizationController] socket broadcast failed:', err.message);
  }

  // Web Push — non-blocking
  sendPushForMobilization(mob).catch((err) => {
    console.warn('[mobilizationController] push notification failed:', err.message);
  });

  res.status(201).json({ success: true, data: { mobilization: mob } });
});

/**
 * GET /api/mobilization/active
 * Returns active mobilization(s) relevant to the requesting user's scope.
 */
exports.getActive = asyncHandler(async (req, res) => {
  const mobilizations = await getActiveMobilization(req.user);
  res.json({ success: true, data: { mobilizations } });
});

/**
 * PATCH /api/mobilization/:id/status
 * Advance the mobilization to the next phase (ACTIVE→TRANSIT→PREPARATION→DEPLOYMENT).
 */
exports.advanceStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const mob = await advanceMobilizationStatus({
    mobilizationId: req.params.id,
    nextStatus: status,
    actor: req.user
  });

  try {
    getSocketService().broadcastMobilizationUpdate(mob, 'mobilization:status_changed');
  } catch (err) {
    console.warn('[mobilizationController] socket broadcast failed:', err.message);
  }

  // Push — non-blocking; notify in-scope users of phase change
  sendPushForMobilization(mob).catch((err) => {
    console.warn('[mobilizationController] push notification failed:', err.message);
  });

  res.json({ success: true, data: { mobilization: mob } });
});

/**
 * PATCH /api/mobilization/:id/stand-down
 * Stand down an active mobilization.
 */
exports.standDown = asyncHandler(async (req, res) => {
  const mob = await standDownMobilization({
    mobilizationId: req.params.id,
    actor: req.user
  });

  try {
    getSocketService().broadcastMobilizationUpdate(mob, 'mobilization:stood_down');
  } catch (err) {
    console.warn('[mobilizationController] socket broadcast failed:', err.message);
  }

  // Push — non-blocking; notify in-scope users stand-down is complete
  sendPushForMobilization(mob).catch((err) => {
    console.warn('[mobilizationController] push notification failed:', err.message);
  });

  res.json({ success: true, data: { mobilization: mob } });
});
