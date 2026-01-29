const ViolationEvent = require('../models/ViolationEvent');
const {
  getActiveAos,
  findAoForPointWithTolerance,
  distanceToPolygonEdgeMeters
} = require('../utils/aoDetection');

class BreachService {
  constructor({ io, emitToUser, emitToAdmins, violationModel, aoDetection, configOverrides } = {}) {
    if (!io) {
      throw new Error('BreachService requires a socket.io instance');
    }
    if (!emitToUser || !emitToAdmins) {
      throw new Error('BreachService requires emit functions');
    }

    const detection = aoDetection || {};

    this.io = io;
    this.emitToUser = emitToUser;
    this.emitToAdmins = emitToAdmins;
    this.violationModel = violationModel || ViolationEvent;
    this.aoDetection = {
      getActiveAos: detection.getActiveAos || getActiveAos,
      findAoForPointWithTolerance: detection.findAoForPointWithTolerance || findAoForPointWithTolerance,
      distanceToPolygonEdgeMeters: detection.distanceToPolygonEdgeMeters || distanceToPolygonEdgeMeters
    };
    this.userBreachState = new Map(); // userId -> { outsideSince, lastAlertAt, lastSafeAo }
    this.breachConfig = {
      gpsToleranceMeters: this.parseConfigNumber('AO_BREACH_GPS_TOLERANCE_METERS', 15),
      graceMs: this.parseConfigNumber('AO_BREACH_GRACE_MS', 10000),
      cooldownMs: this.parseConfigNumber('AO_BREACH_COOLDOWN_MS', 60000),
      sustainedMs: this.parseConfigNumber('AO_BREACH_SUSTAINED_MS', 120000),
      approachingMeters: this.parseConfigNumber('AO_APPROACHING_THRESHOLD_METERS', 50),
      approachingCooldownMs: this.parseConfigNumber('AO_APPROACHING_COOLDOWN_MS', 30000),
      ...(configOverrides || {})
    };
  }

  parseConfigNumber(envKey, fallback) {
    const raw = process.env[envKey];
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return fallback;
  }

  clearUserState(userId) {
    if (!userId) {
      return;
    }
    this.userBreachState.delete(userId);
  }

  async evaluateAoBreach({ user, coordinates, timestamp }) {
    if (!user || !coordinates || coordinates.length !== 2) {
      return;
    }

    const companyId = user.companyId;
    if (!companyId) {
      return;
    }

    const activeAos = await this.aoDetection.getActiveAos({ companyId });
    if (!activeAos || activeAos.length === 0) {
      this.userBreachState.delete(user._id.toString());
      return;
    }

    const point = [coordinates[0], coordinates[1]];
    const toleranceMeters = this.breachConfig.gpsToleranceMeters;
    const insideAo = this.aoDetection.findAoForPointWithTolerance(point, activeAos, toleranceMeters);
    const userId = user._id.toString();
    const now = Date.now();

    const state = this.userBreachState.get(userId) || {
      outsideSince: null,
      lastAlertAt: 0,
      lastSafeAo: null,
      lastApproachAt: 0,
      lastSustainedAt: 0
    };

    if (insideAo) {
      const distanceToBoundary = this.aoDetection.distanceToPolygonEdgeMeters(point, insideAo.polygon);
      const shouldNotifyApproach =
        Number.isFinite(distanceToBoundary) &&
        distanceToBoundary <= this.breachConfig.approachingMeters &&
        now - (state.lastApproachAt || 0) >= this.breachConfig.approachingCooldownMs;

      if (shouldNotifyApproach) {
        state.lastApproachAt = now;
        await this.createViolationEvent({
          type: 'APPROACHING_BOUNDARY',
          user,
          coordinates,
          ao: insideAo,
          distanceToBoundaryMeters: distanceToBoundary,
          timestamp: timestamp || new Date().toISOString()
        });
      }

      state.outsideSince = null;
      state.lastSafeAo = {
        id: insideAo._id?.toString?.() || String(insideAo._id),
        name: insideAo.name
      };
      state.lastSustainedAt = 0;
      this.userBreachState.set(userId, state);
      return;
    }

    if (!state.outsideSince) {
      state.outsideSince = now;
      this.userBreachState.set(userId, state);
      return;
    }

    if (now - state.outsideSince < this.breachConfig.graceMs) {
      this.userBreachState.set(userId, state);
      return;
    }

    if (now - (state.lastAlertAt || 0) < this.breachConfig.cooldownMs) {
      this.userBreachState.set(userId, state);
      return;
    }

    state.lastAlertAt = now;
    this.userBreachState.set(userId, state);

    await this.createViolationEvent({
      type: 'BREACH',
      user,
      coordinates,
      ao: state.lastSafeAo,
      breachSince: new Date(state.outsideSince).toISOString(),
      timestamp: timestamp || new Date().toISOString()
    });

    if (
      now - state.outsideSince >= this.breachConfig.sustainedMs &&
      now - (state.lastSustainedAt || 0) >= this.breachConfig.cooldownMs
    ) {
      state.lastSustainedAt = now;
      this.userBreachState.set(userId, state);

      await this.createViolationEvent({
        type: 'SUSTAINED_BREACH',
        user,
        coordinates,
        ao: state.lastSafeAo,
        breachSince: new Date(state.outsideSince).toISOString(),
        timestamp: timestamp || new Date().toISOString()
      });
    }

    const payload = {
      userId,
      name: user.name,
      email: user.email,
      role: user.role,
      coordinates,
      timestamp: timestamp || new Date().toISOString(),
      breachSince: new Date(state.outsideSince).toISOString(),
      ao: state.lastSafeAo,
      toleranceMeters: this.breachConfig.gpsToleranceMeters,
      graceMs: this.breachConfig.graceMs,
      cooldownMs: this.breachConfig.cooldownMs
    };

    this.emitToAdmins('ao:breach', payload);
    this.emitToUser(userId, 'ao:breach', payload);
  }

  async createViolationEvent({ type, user, coordinates, ao, distanceToBoundaryMeters, breachSince, timestamp }) {
    if (!user?._id || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return;
    }

    const aoId = ao?._id || ao?.id || null;
    const aoName = ao?.name || null;
    const occurredAt = new Date(timestamp || Date.now());

    try {
      await this.violationModel.create({
        type,
        userId: user._id,
        companyId: user.companyId,
        unitId: user.unitId,
        teamId: user.teamId,
        squadId: user.squadId,
        aoId,
        aoName,
        coordinates,
        distanceToBoundaryMeters: Number.isFinite(distanceToBoundaryMeters)
          ? distanceToBoundaryMeters
          : null,
        breachSince: breachSince ? new Date(breachSince) : null,
        occurredAt
      });
    } catch (error) {
      console.warn('Failed to create violation event:', error.message);
    }
  }
}

module.exports = BreachService;
