const mongoose = require('mongoose');
const { OPERATIONAL_ROLES } = require('../utils/roles');

const inviteTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  usedAt: {
    type: Date,
    default: null
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedRole: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  assignedOperationalRole: {
    type: String,
    enum: OPERATIONAL_ROLES,
    required: true
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  squadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    required: true
  },
  inviterName: {
    type: String,
    default: ''
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

inviteTokenSchema.index({ createdBy: 1 });
inviteTokenSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('InviteToken', inviteTokenSchema);
