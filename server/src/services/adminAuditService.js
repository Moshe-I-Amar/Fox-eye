const AdminAuditLog = require('../models/AdminAuditLog');

const logAdminAction = async ({
  action,
  actorUserId,
  targetType,
  targetId,
  before = null,
  after = null
}) => {
  if (!action || !actorUserId || !targetType || !targetId) {
    return null;
  }

  const entry = await AdminAuditLog.create({
    action,
    actorUserId,
    targetType,
    targetId,
    before,
    after
  });

  return entry;
};

module.exports = {
  logAdminAction
};
