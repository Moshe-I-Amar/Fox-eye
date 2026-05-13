const FieldEvent = require('../models/FieldEvent');
const { AppError } = require('../utils/errors');

const MAX_VELOCITY_MPS = 50;
const MAX_TIMESTAMP_SKEW_MS = 30_000;

const toRad = (d) => (d * Math.PI) / 180;

const haversineMeters = ([lng1, lat1], [lng2, lat2]) => {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const validateAntiSpoof = async (senderId, coordinates) => {
  const lastEvent = await FieldEvent.findOne({ senderId })
    .sort({ createdAt: -1 })
    .select('coordinates createdAt')
    .lean();

  if (!lastEvent) return;

  const distM = haversineMeters(
    lastEvent.coordinates.coordinates,
    coordinates
  );
  const deltaMs = Date.now() - new Date(lastEvent.createdAt).getTime();
  const velocityMps = distM / (deltaMs / 1000);

  if (velocityMps > MAX_VELOCITY_MPS) {
    throw new AppError(
      'FIELD_EVENT_VELOCITY_EXCEEDED',
      'GPS velocity check failed — position update rejected',
      422
    );
  }
};

const createFieldEvent = async ({ sender, eventType, coordinates }) => {
  const event = await FieldEvent.create({
    eventType,
    senderId: sender._id,
    coordinates: { type: 'Point', coordinates },
    unitId:    sender.unitId,
    companyId: sender.companyId,
    teamId:    sender.teamId,
    squadId:   sender.squadId,
    status: 'ACTIVE'
  });
  return event;
};

const listFieldEvents = async ({ scopeQuery, status, eventType, page, limit }) => {
  const skip = (page - 1) * limit;
  const filters = [scopeQuery];
  if (status)    filters.push({ status });
  if (eventType) filters.push({ eventType });
  const query = filters.length > 1 ? { $and: filters } : filters[0];

  const [events, total] = await Promise.all([
    FieldEvent.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'name operationalRole')
      .lean(),
    FieldEvent.countDocuments(query)
  ]);

  return { events, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const acknowledgeFieldEvent = async ({ id, scopeQuery, actorId }) => {
  const event = await FieldEvent.findOneAndUpdate(
    { $and: [{ _id: id, status: 'ACTIVE' }, scopeQuery] },
    { status: 'ACKNOWLEDGED', acknowledgedBy: actorId, acknowledgedAt: new Date() },
    { new: true }
  );
  if (!event) throw new AppError('NOT_FOUND', 'Field event not found or already acknowledged', 404);
  return event;
};

const resolveFieldEvent = async ({ id, scopeQuery, actorId }) => {
  const event = await FieldEvent.findOneAndUpdate(
    { $and: [{ _id: id, status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] } }, scopeQuery] },
    { status: 'RESOLVED', resolvedBy: actorId, resolvedAt: new Date() },
    { new: true }
  );
  if (!event) throw new AppError('NOT_FOUND', 'Field event not found or already resolved', 404);
  return event;
};

module.exports = {
  validateAntiSpoof,
  MAX_TIMESTAMP_SKEW_MS,
  createFieldEvent,
  listFieldEvents,
  acknowledgeFieldEvent,
  resolveFieldEvent
};
