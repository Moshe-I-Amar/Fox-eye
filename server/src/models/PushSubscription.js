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
    // Expo push (mobile) — mutually exclusive with VAPID keys
    platform:   { type: String, enum: ['web', 'expo'], default: 'web' },
    expoToken:  { type: String, default: null },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ userId: 1 });
// endpoint unique per platform (expo rows have no endpoint)
pushSubscriptionSchema.index({ endpoint: 1, platform: 1 }, { unique: true, sparse: true });
// expoToken globally unique (one device = one subscription)
pushSubscriptionSchema.index({ expoToken: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
