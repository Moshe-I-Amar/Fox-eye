'use strict';

const mongoose = require('mongoose');

const MOBILIZATION_STATUSES = ['ACTIVE', 'TRANSIT', 'PREPARATION', 'DEPLOYMENT', 'STOOD_DOWN'];

// Status transition map — only these forward movements are allowed via the
// /status endpoint. Stood-down is handled by its own dedicated endpoint.
const VALID_TRANSITIONS = {
  ACTIVE:      ['TRANSIT'],
  TRANSIT:     ['PREPARATION'],
  PREPARATION: ['DEPLOYMENT'],
  DEPLOYMENT:  []  // terminal until stood down
};

const mobilizationEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: MOBILIZATION_STATUSES,
      default: 'ACTIVE',
      required: true
    },

    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    incidentDescription: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: null
    },

    rallyPoint: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        validate: {
          validator(coords) {
            return (
              coords.length === 2 &&
              coords[0] >= -180 && coords[0] <= 180 &&
              coords[1] >= -90  && coords[1] <= 90
            );
          },
          message: 'Rally point coordinates must be [longitude, latitude] in valid ranges'
        }
      }
    },

    rallyPointName: {
      type: String,
      trim: true,
      maxlength: [100, 'Rally point name cannot exceed 100 characters'],
      default: null
    },

    /**
     * Selective scope — the narrowest hierarchy level this mobilization targets.
     *
     * Resolution rules (narrowest takes precedence):
     *   teamId set    → target = all squads within that team
     *   companyId set → target = all teams/squads within that company
     *   unitId only   → target = entire unit
     *
     * unitId is always required (mobilization must belong to a unit).
     * companyId must be provided if teamId is provided.
     */
    targetScope: {
      unitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Unit',
        required: [true, 'targetScope.unitId is required']
      },
      companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        default: null
      },
      teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        default: null
      }
    },

    // Mission sector assignments — populated during DEPLOYMENT phase
    missionAOs: [
      {
        aoId: { type: mongoose.Schema.Types.ObjectId, ref: 'AO' },
        assignedTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        objective: { type: String, trim: true, maxlength: 200 }
      }
    ],

    stoodDownAt: { type: Date, default: null },
    stoodDownBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

// Index for fast "active mobilization for this unit" look-up
mobilizationEventSchema.index({ 'targetScope.unitId': 1, status: 1 });
mobilizationEventSchema.index({ 'targetScope.companyId': 1, status: 1 });
mobilizationEventSchema.index({ triggeredBy: 1, createdAt: -1 });

const MobilizationEvent = mongoose.model('MobilizationEvent', mobilizationEventSchema);

module.exports = MobilizationEvent;
module.exports.MOBILIZATION_STATUSES = MOBILIZATION_STATUSES;
module.exports.VALID_TRANSITIONS = VALID_TRANSITIONS;
