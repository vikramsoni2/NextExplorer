const { resolvePathWithAccess, getAccessInfo } = require('./accessManager');

const ACTIONS = Object.freeze({
  list: 'list',
  read: 'read',
  write: 'write',
  delete: 'delete',
  upload: 'upload',
  createFolder: 'createFolder',
  rename: 'rename',
  download: 'download',
  createShare: 'createShare',
});

const actionToFlag = (action) => {
  switch (action) {
    case ACTIONS.list:
    case ACTIONS.read:
      return 'canRead';
    case ACTIONS.write:
      return 'canWrite';
    case ACTIONS.delete:
      return 'canDelete';
    case ACTIONS.upload:
      return 'canUpload';
    case ACTIONS.createFolder:
      return 'canCreateFolder';
    case ACTIONS.rename:
      return 'canWrite';
    case ACTIONS.download:
      return 'canDownload';
    case ACTIONS.createShare:
      return 'canShare';
    default:
      return null;
  }
};

const authorizePath = async (context, logicalPath, action, options = {}) => {
  const accessInfo = await getAccessInfo(context, logicalPath, options);
  if (!accessInfo?.canAccess) {
    return { allowed: false, accessInfo };
  }

  const flag = actionToFlag(action);
  if (!flag) {
    return { allowed: false, accessInfo: { ...accessInfo, denialReason: 'Unknown action' } };
  }

  return { allowed: Boolean(accessInfo[flag]), accessInfo };
};

const authorizeAndResolve = async (context, logicalPath, action, options = {}) => {
  const { accessInfo, resolved } = await resolvePathWithAccess(context, logicalPath, options);
  if (!accessInfo?.canAccess || !resolved) {
    return { allowed: false, accessInfo, resolved: null };
  }

  const flag = actionToFlag(action);
  if (!flag) {
    return {
      allowed: false,
      accessInfo: { ...accessInfo, denialReason: 'Unknown action' },
      resolved: null,
    };
  }

  if (!accessInfo[flag]) {
    return { allowed: false, accessInfo, resolved: null };
  }

  return { allowed: true, accessInfo, resolved };
};

module.exports = {
  ACTIONS,
  authorizePath,
  authorizeAndResolve,
};
