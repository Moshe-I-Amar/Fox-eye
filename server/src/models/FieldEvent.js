const mongoose = require('mongoose');

const FIELD_EVENT_TYPES = ['INJURED', 'AMBUSH', 'LINK_UP'];
const FIELD_EVENT_STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'];

const fieldEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: FIELD_EVENT_TYPES,
      required: [true, 'Event type is required']
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required']
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: [true, 'Coordinates are required'],
        validate: {
          validator(coords) {
            return (
              coords.length === 2 &&
              coords[0] >= -180 && coords[0] <= 180 &&
              coords[1] >= -90 && coords[1] <= 90
            );
          },
          message: 'Coordinates must be [longitude, latitude] in valid ranges'
        }
      }
    },
    status: {
      type: String,
      enum: FIELD_EVENT_STATUSES,
      default: 'ACTIVE'
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    acknowledgedAt: { type: Date, default: null },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: { type: Date, default: null },
    unitId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Unit',    required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    teamId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Team',    required: true },
    squadId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Squad',   required: true }
  },
  { timestamps: true }
);

fieldEventSchema.index({ coordinates: '2dsphere' });
fieldEventSchema.index({ unitId:    1, createdAt: -1 });
fieldEventSchema.index({ companyId: 1, createdAt: -1 });
fieldEventSchema.index({ teamId:    1, createdAt: -1 });
fieldEventSchema.index({ squadId:   1, createdAt: -1 });
fieldEventSchema.index({ senderId:  1, createdAt: -1 });
fieldEventSchema.index({ status:    1, createdAt: -1 });

const FieldEvent = mongoose.model('FieldEvent', fieldEventSchema);

module.exports = FieldEvent;
module.exports.FIELD_EVENT_TYPES = FIELD_EVENT_TYPES;
module.exports.FIELD_EVENT_STATUSES = FIELD_EVENT_STATUSES;
