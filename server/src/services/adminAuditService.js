const AdminAuditLog = require('../models/AdminAuditLog');

const logAdminAction = async ({
  action,
  actorUserId,
  targetType,
  targetId,
  before = null,
  after = null,
  session = null
}) => {
  if (!action || !actorUserId || !targetType || !targetId) {
    return null;
  }

  const options = session ? { session } : {};
  const [entry] = await AdminAuditLog.create(
    [{ action, actorUserId, targetType, targetId, before, after }],
    options
  );

  return entry;
};

module.exports = {
  logAdminAction
};
