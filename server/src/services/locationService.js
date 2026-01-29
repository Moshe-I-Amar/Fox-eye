const User = require('../models/User');
const { getAoForPoint, toAoSummary } = require('../utils/aoDetection');

class LocationService {
  constructor({ userModel = User, aoUtils = { getAoForPoint, toAoSummary } } = {}) {
    this.userModel = userModel;
    this.aoUtils = aoUtils;
  }

  validateCoordinates(coordinates) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      throw new Error('Invalid coordinates format');
    }

    const [longitude, latitude] = coordinates;

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new Error('Coordinates must be numbers');
    }

    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      throw new Error('Coordinates out of valid range');
    }

    return [longitude, latitude];
  }

  buildLocationUpdatePayload({ user, coordinates, ao, updatedAt, timestamp }) {
    return {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      coordinates,
      location: {
        type: 'Point',
        coordinates
      },
      ao: ao || null,
      updatedAt: updatedAt || new Date().toISOString(),
      timestamp: timestamp || new Date().toISOString()
    };
  }

  async updateUserLocation({
    userId,
    user,
    coordinates,
    timestamp,
    socketService,
    excludeSocketId,
    suppressSocketErrors = false
  }) {
    const validatedCoordinates = this.validateCoordinates(coordinates);
    const targetUser = user || (await this.userModel.findById(userId));

    if (!targetUser) {
      throw new Error('User not found');
    }

    targetUser.location = {
      type: 'Point',
      coordinates: validatedCoordinates
    };

    await targetUser.save();

    const ao = await this.aoUtils.getAoForPoint({
      point: validatedCoordinates,
      companyId: targetUser.companyId
    });
    const aoSummary = this.aoUtils.toAoSummary(ao);
    const updatedAt = targetUser.updatedAt
      ? targetUser.updatedAt.toISOString()
      : new Date().toISOString();

    const resolvedTimestamp = timestamp || updatedAt;

    const payload = this.buildLocationUpdatePayload({
      user: targetUser,
      coordinates: validatedCoordinates,
      ao: aoSummary,
      updatedAt,
      timestamp: resolvedTimestamp
    });

    if (socketService) {
      try {
        await socketService.evaluateAoBreach({
          user: targetUser,
          coordinates: validatedCoordinates,
          timestamp: payload.timestamp
        });
      } catch (error) {
        if (!suppressSocketErrors) {
          throw error;
        }
        console.warn('AO breach evaluation failed:', error.message);
      }

      try {
        await socketService.broadcastLocationUpdate({
          payload,
          excludeSocketId
        });
      } catch (error) {
        if (!suppressSocketErrors) {
          throw error;
        }
        console.warn('Socket emit failed for location:update:', error.message);
      }
    }

    return {
      user: targetUser,
      ao: aoSummary,
      payload
    };
  }
}

module.exports = {
  LocationService
};
