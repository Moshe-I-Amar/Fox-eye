const mongoose = require('mongoose');

const VIOLATION_EVENT_TYPES = [
  'APPROACHING_BOUNDARY',
  'BREACH',
  'SUSTAINED_BREACH'
];

const violationEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: VIOLATION_EVENT_TYPES,
      required: [true, 'Violation event type is required']
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required']
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required']
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: [true, 'Unit is required']
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team is required']
    },
    squadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad',
      required: [true, 'Squad is required']
    },
    aoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AO',
      default: null
    },
    aoName: {
      type: String,
      trim: true,
      default: null
    },
    coordinates: {
      type: [Number],
      validate: {
        validator: function(coords) {
          return coords.length === 2 &&
            coords[0] >= -180 && coords[0] <= 180 &&
            coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Coordinates must be [longitude, latitude] in valid ranges'
      },
      required: [true, 'Coordinates are required']
    },
    distanceToBoundaryMeters: {
      type: Number,
      default: null
    },
    breachSince: {
      type: Date,
      default: null
    },
    occurredAt: {
      type: Date,
      required: [true, 'Occurred timestamp is required']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ViolationEvent', violationEventSchema);
