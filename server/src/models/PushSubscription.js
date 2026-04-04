const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth:   { type: String, required: true },
    },
    // Denormalized hierarchy — used for scope-based push targeting
    role:      { type: String },
    unitId:    { type: mongoose.Schema.Types.ObjectId },
    companyId: { type: mongoose.Schema.Types.ObjectId },
    teamId:    { type: mongoose.Schema.Types.ObjectId },
    squadId:   { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ userId: 1 });
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
