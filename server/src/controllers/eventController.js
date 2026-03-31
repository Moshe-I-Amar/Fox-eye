const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { buildScopeQuery } = require('../utils/filterByScope');
const { LocationService } = require('../services/locationService');
const {
  validateAntiSpoof,
  MAX_TIMESTAMP_SKEW_MS,
  createFieldEvent,
  listFieldEvents,
  acknowledgeFieldEvent,
  resolveFieldEvent
} = require('../services/fieldEventService');
const { getSocketService } = require('../realtime/socket');

const locationService = new LocationService();

// POST /api/events
const createEvent = asyncHandler(async (req, res) => {
  const { eventType, coordinates, timestamp } = req.body;

  const validCoords = locationService.validateCoordinates(coordinates);

  if (timestamp) {
    const clientTime = new Date(timestamp).getTime();
    if (Number.isNaN(clientTime)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid timestamp', 400);
    }
    if (Math.abs(Date.now() - clientTime) > MAX_TIMESTAMP_SKEW_MS) {
      throw new AppError(
        'FIELD_EVENT_TIMESTAMP_SKEW',
        'Client timestamp is too far from server time',
        422
      );
    }
  }

  await validateAntiSpoof(req.user.id, validCoords);

  const event = await createFieldEvent({
    sender: req.userDoc,
    eventType,
    coordinates: validCoords
  });

  try {
    const socketService = getSocketService();
    socketService.broadcastFieldEvent(event);
  } catch (_) {
    console.warn('Field event socket broadcast failed');
  }

  res.status(201).json({ success: true, data: { event } });
});

// GET /api/events
const listEvents = asyncHandler(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 25;
  const scopeQuery = buildScopeQuery(req.scope);

  if (!scopeQuery) {
    return res.json({
      success: true,
      data: { events: [], pagination: { page, limit, total: 0, pages: 0 } }
    });
  }

  const result = await listFieldEvents({
    scopeQuery,
    status:    req.query.status    || null,
    eventType: req.query.eventType || null,
    page,
    limit
  });

  res.json({ success: true, data: result });
});

// PATCH /api/events/:id/acknowledge
const acknowledgeEvent = asyncHandler(async (req, res) => {
  const scopeQuery = buildScopeQuery(req.scope);
  if (!scopeQuery) throw new AppError('NOT_FOUND', 'Field event not found', 404);

  const event = await acknowledgeFieldEvent({
    id:      req.params.id,
    scopeQuery,
    actorId: req.user.id
  });

  try {
    const socketService = getSocketService();
    socketService.broadcastFieldEventAck(event);
  } catch (_) {}

  res.json({ success: true, data: { event } });
});

// PATCH /api/events/:id/resolve
const resolveEvent = asyncHandler(async (req, res) => {
  const scopeQuery = buildScopeQuery(req.scope);
  if (!scopeQuery) throw new AppError('NOT_FOUND', 'Field event not found', 404);

  const event = await resolveFieldEvent({
    id:      req.params.id,
    scopeQuery,
    actorId: req.user.id
  });

  try {
    const socketService = getSocketService();
    socketService.broadcastFieldEventResolve(event);
  } catch (_) {}

  res.json({ success: true, data: { event } });
});

module.exports = { createEvent, listEvents, acknowledgeEvent, resolveEvent };
