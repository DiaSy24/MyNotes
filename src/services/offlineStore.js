// Local cache + outbox for offline use.
// Cache: last known workspaces/notes/trash per user, shown when the network is down.
// Outbox: write operations made while offline, replayed in order once back online.

const CACHE_KEY = (uid) => `mynotes_cache_${uid}`;
const OUTBOX_KEY = (uid) => `mynotes_outbox_${uid}`;
const LAST_USER_KEY = 'mynotes_last_user';

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Local cache write failed:', e);
  }
};

export const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

export const isNetworkError = (error) => {
  if (!isOnline()) return true;
  if (!error) return false;
  if (error instanceof TypeError) return true;
  const msg = `${error.message || ''} ${error.details || ''}`;
  return /failed to fetch|fetch failed|network|load failed|timeout/i.test(msg);
};

// Errors worth retrying later instead of dropping the queued change:
// connectivity problems and expired/missing auth (the session refreshes on its own).
const isRetryableError = (error) => {
  if (isNetworkError(error)) return true;
  const msg = `${error?.message || ''} ${error?.code || ''}`;
  return error?.status === 401 || /jwt|PGRST301/i.test(msg);
};

// ---------- Cache ----------

export const getLastUserId = () => {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
};

export const setLastUserId = (uid) => {
  try {
    if (uid) localStorage.setItem(LAST_USER_KEY, uid);
    else localStorage.removeItem(LAST_USER_KEY);
  } catch { /* ignore */ }
};

export const loadCache = (uid) => {
  if (!uid) return null;
  return readJSON(CACHE_KEY(uid), null);
};

export const saveCache = (uid, data) => {
  if (!uid) return;
  writeJSON(CACHE_KEY(uid), data);
};

// ---------- Outbox ----------

let currentUserId = null;
let isFlushing = false;

export const setOutboxUser = (uid) => {
  currentUserId = uid;
  emitSyncStatus();
};

export const getQueue = () => (currentUserId ? readJSON(OUTBOX_KEY(currentUserId), []) : []);

const setQueue = (queue) => {
  if (!currentUserId) return;
  writeJSON(OUTBOX_KEY(currentUserId), queue);
  emitSyncStatus();
};

export const emitSyncStatus = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app_sync_status', {
    detail: { online: isOnline(), pending: getQueue().length, flushing: isFlushing }
  }));
};

// Save ops for the same row collapse into one (latest wins), so a note edited
// ten times offline sends a single upsert.
const COALESCE_TYPES = new Set(['saveNote', 'saveWorkspace']);

export const enqueue = (op) => {
  let queue = getQueue();
  if (COALESCE_TYPES.has(op.type) && op.key) {
    queue = queue.filter(q => !(q.type === op.type && q.key === op.key));
  }
  queue.push({
    ...op,
    opId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString()
  });
  setQueue(queue);
};

const removeOp = (opId) => setQueue(getQueue().filter(q => q.opId !== opId));

// executor(op) must resolve to { ok: true } or { ok: false, error }.
export const flushOutbox = async (executor) => {
  if (isFlushing || !currentUserId || !isOnline()) return { flushed: 0 };
  if (getQueue().length === 0) return { flushed: 0 };

  isFlushing = true;
  emitSyncStatus();
  let flushed = 0;
  try {
    // Re-read storage every step: new ops may be queued while a request is in flight.
    let op;
    while ((op = getQueue()[0])) {
      let result;
      try {
        result = await executor(op);
      } catch (error) {
        result = { ok: false, error };
      }
      if (!result.ok && isRetryableError(result.error)) break; // still offline, retry later
      if (!result.ok) console.error('Dropping queued operation after server error:', op, result.error);
      removeOp(op.opId);
      flushed += 1;
    }
  } finally {
    isFlushing = false;
    emitSyncStatus();
  }
  return { flushed };
};
