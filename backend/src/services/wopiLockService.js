const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

const locks = new Map();

const getNow = () => Date.now();

const purgeIfExpired = (fileId, nowMs = getNow()) => {
  const entry = locks.get(fileId);
  if (!entry) return null;
  if (entry.expiresAtMs <= nowMs) {
    locks.delete(fileId);
    return null;
  }
  return entry;
};

const getLock = (fileId, nowMs) => {
  const entry = purgeIfExpired(fileId, nowMs);
  return entry ? entry.lockId : null;
};

const tryLock = (fileId, lockId, nowMs, ttlMs = DEFAULT_LOCK_TTL_MS) => {
  const entry = purgeIfExpired(fileId, nowMs);
  if (entry && entry.lockId !== lockId) {
    return { ok: false, currentLockId: entry.lockId };
  }
  locks.set(fileId, { lockId, expiresAtMs: (nowMs ?? getNow()) + ttlMs });
  return { ok: true };
};

const tryUnlock = (fileId, lockId, nowMs) => {
  const entry = purgeIfExpired(fileId, nowMs);
  if (!entry) return { ok: true };
  if (entry.lockId !== lockId) return { ok: false, currentLockId: entry.lockId };
  locks.delete(fileId);
  return { ok: true };
};

const tryRefreshLock = (fileId, lockId, nowMs, ttlMs = DEFAULT_LOCK_TTL_MS) => {
  const entry = purgeIfExpired(fileId, nowMs);
  if (!entry) return { ok: false, currentLockId: null };
  if (entry.lockId !== lockId) return { ok: false, currentLockId: entry.lockId };
  locks.set(fileId, { lockId, expiresAtMs: (nowMs ?? getNow()) + ttlMs });
  return { ok: true };
};

const tryUnlockAndRelock = (fileId, oldLockId, newLockId, nowMs, ttlMs = DEFAULT_LOCK_TTL_MS) => {
  const entry = purgeIfExpired(fileId, nowMs);
  if (entry && entry.lockId !== oldLockId) return { ok: false, currentLockId: entry.lockId };
  locks.set(fileId, { lockId: newLockId, expiresAtMs: (nowMs ?? getNow()) + ttlMs });
  return { ok: true };
};

const resetAllLocks = () => {
  locks.clear();
};

module.exports = {
  DEFAULT_LOCK_TTL_MS,
  getLock,
  tryLock,
  tryUnlock,
  tryRefreshLock,
  tryUnlockAndRelock,
  resetAllLocks,
};
