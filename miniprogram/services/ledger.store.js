const ledgerService = require("./ledger.service");
const categoryStore = require("./category.store");
const { getLedgerRole } = require("../utils/mapper");

const CACHE_KEY = "tomatoLedgerLedgerCache";
const DEFAULT_SYNC_INTERVAL_MS = 2 * 60 * 1000;
let refreshRequest = null;
let syncRequest = null;
let generation = 0;
const syncListeners = new Set();

function getAppInstance(appInstance) {
  return appInstance || getApp();
}

function getScope(appInstance) {
  const app = getAppInstance(appInstance);
  const globalData = app && app.globalData;
  if (!globalData) return "";
  const environment = globalData.environment || {};
  const openid = globalData.openid || "";
  return openid ? `${environment.key || "default"}:${openid}` : "";
}

function readCacheRecord(appInstance) {
  const cached = wx.getStorageSync(CACHE_KEY);
  const scope = getScope(appInstance);
  if (!scope || !cached || cached.scope !== scope || !Array.isArray(cached.ledgers)) return null;
  return cached;
}

function readCache(appInstance) {
  const cached = readCacheRecord(appInstance);
  return cached ? cached.ledgers : [];
}

function getRevisions(ledgers = []) {
  return ledgers.reduce((result, ledger) => {
    const ledgerId = ledger._id || ledger.id;
    if (ledgerId) result[ledgerId] = Number(ledger.syncRevision || 0);
    return result;
  }, {});
}

function writeCache(ledgers, options = {}) {
  const app = getAppInstance();
  const scope = getScope();
  if (!scope) return;
  const rows = Array.isArray(ledgers) ? ledgers : [];
  const previous = readCacheRecord(app) || {};
  wx.setStorageSync(CACHE_KEY, {
    scope,
    ledgers: rows,
    revisions: options.revisions || getRevisions(rows),
    updatedAt: Date.now(),
    lastSyncedAt: options.lastSyncedAt || previous.lastSyncedAt || 0,
  });
  if (app && app.globalData) app.globalData.ledgers = rows;
}

function updateCurrentLedger(app, ledgers, currentLedgerId) {
  if (!app || !app.globalData) return;
  const currentId = currentLedgerId || (app.globalData.currentLedger || {})._id || "";
  const currentLedger = ledgers.find((ledger) => (ledger._id || ledger.id) === currentId) || null;
  const role = getLedgerRole(app.globalData.openid, currentLedger || {});
  app.globalData.currentLedger = currentLedger;
  if (currentLedger) {
    currentLedger.role = role;
    currentLedger.readonly = role === "readonly";
  }
  app.globalData.readonly = role === "readonly";
  if (app.globalData.user) app.globalData.user.currentLedgerId = currentLedger ? currentId : "";
  if (typeof app.persistAuthState === "function") app.persistAuthState();
}

function emitSync(result) {
  syncListeners.forEach((listener) => {
    try {
      listener(result);
    } catch (error) {
      console.warn("ledger sync listener failed", error);
    }
  });
}

function subscribeSync(listener) {
  if (typeof listener !== "function") return () => {};
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function getLastSyncedAt(appInstance) {
  const cached = readCacheRecord(getAppInstance(appInstance));
  return Number((cached && cached.lastSyncedAt) || 0);
}

function markSyncRequired() {
  const app = getAppInstance();
  const cached = readCacheRecord(app);
  if (!cached) return;
  wx.setStorageSync(CACHE_KEY, { ...cached, lastSyncedAt: 0 });
}

function getCachedLedgers(appInstance) {
  const app = getAppInstance(appInstance);
  const ledgers = readCache(app);
  if (app && app.globalData) app.globalData.ledgers = ledgers;
  return ledgers;
}

async function refreshLedgers(options = {}) {
  const requestScope = getScope();
  const requestGeneration = generation;
  const force = Boolean(options.force);
  if (refreshRequest) {
    if (!force) return refreshRequest;
    const activeRequest = refreshRequest;
    try {
      await activeRequest;
    } catch (_error) {
      // A forced refresh must still retry after an earlier request fails.
    }
    if (refreshRequest && refreshRequest !== activeRequest) return refreshRequest;
  }
  if (requestScope !== getScope() || requestGeneration !== generation)
    throw new Error("登录状态已变化，请重试");
  refreshRequest = ledgerService
    .listLedgers()
    .then((data) => {
      if (requestScope !== getScope() || requestGeneration !== generation)
        throw new Error("登录状态已变化，请重试");
      const ledgers = data.ledgers || [];
      writeCache(ledgers, { lastSyncedAt: Date.now() });
      return ledgers;
    })
    .finally(() => {
      if (requestGeneration === generation) refreshRequest = null;
    });
  return refreshRequest;
}

async function getLedgers() {
  const app = getAppInstance();
  const cached = readCacheRecord(app);
  if (!cached) return refreshLedgers();
  if (app && app.globalData) app.globalData.ledgers = cached.ledgers;
  return cached.ledgers;
}

async function syncLedgers(options = {}) {
  const requestScope = getScope();
  const requestGeneration = generation;
  const force = Boolean(options.force);
  const app = getAppInstance();
  const cached = readCacheRecord(app);
  const nowTime = Date.now();
  const syncIntervalMs = Number(options.syncIntervalMs) || DEFAULT_SYNC_INTERVAL_MS;
  if (!force && cached && nowTime - Number(cached.lastSyncedAt || 0) < syncIntervalMs) {
    return { checked: false, changed: false, ledgers: cached.ledgers };
  }
  if (syncRequest) {
    if (!force) return syncRequest;
    const activeRequest = syncRequest;
    try {
      await activeRequest;
    } catch (_error) {
      // A forced sync after a mutation must run even if an earlier check failed.
    }
    if (syncRequest && syncRequest !== activeRequest) return syncRequest;
  }
  if (requestScope !== getScope() || requestGeneration !== generation)
    throw new Error("登录状态已变化，请重试");
  syncRequest = ledgerService
    .syncLedgers((cached && cached.revisions) || getRevisions((cached && cached.ledgers) || []))
    .then((data) => {
      if (requestScope !== getScope() || requestGeneration !== generation)
        throw new Error("登录状态已变化，请重试");
      const changed = Boolean(data.changed);
      (data.changedLedgerIds || []).forEach(categoryStore.invalidate);
      (data.removedLedgerIds || []).forEach(categoryStore.removeLedger);
      const ledgers = changed ? data.ledgers || [] : (cached && cached.ledgers) || [];
      writeCache(ledgers, {
        revisions: data.revisions || getRevisions(ledgers),
        lastSyncedAt: Date.now(),
      });
      if (changed) updateCurrentLedger(app, ledgers, data.currentLedgerId);
      const result = {
        checked: true,
        changed,
        changedLedgerIds: data.changedLedgerIds || [],
        removedLedgerIds: data.removedLedgerIds || [],
        ledgers,
        syncedAt: Date.now(),
      };
      if (options.notify !== false) emitSync(result);
      return result;
    })
    .finally(() => {
      if (requestGeneration === generation) syncRequest = null;
    });
  return syncRequest;
}

async function mutateLedger(method, ...args) {
  if (typeof ledgerService[method] !== "function") throw new Error("LEDGER_MUTATION_NOT_FOUND");
  const result = await ledgerService[method](...args);
  try {
    await syncLedgers({ force: true });
  } catch (error) {
    markSyncRequired();
    console.warn("ledger mutation succeeded but synchronization failed", method, error);
  }
  return result;
}

const createLedger = (data) => mutateLedger("createLedger", data);
async function updateLedger(data) {
  const result = await mutateLedger("updateLedger", data);
  const updatedLedger = result && result.ledger;
  if (!updatedLedger) return result;

  const app = getAppInstance();
  const cached = readCacheRecord(app);
  if (!cached) return result;
  const updatedLedgerId = updatedLedger._id || updatedLedger.id;
  const cachedLedger = cached.ledgers.find(
    (ledger) => (ledger._id || ledger.id) === updatedLedgerId
  );
  if (
    cachedLedger &&
    Number(cachedLedger.syncRevision || 0) >= Number(updatedLedger.syncRevision || 0)
  )
    return result;
  const ledgers = cached.ledgers.map((ledger) => {
    if ((ledger._id || ledger.id) !== updatedLedgerId) return ledger;
    return {
      ...ledger,
      name: updatedLedger.name,
      remark: updatedLedger.remark,
      syncRevision: Math.max(
        Number(ledger.syncRevision || 0),
        Number(updatedLedger.syncRevision || 0)
      ),
    };
  });
  writeCache(ledgers, {
    revisions: getRevisions(ledgers),
    lastSyncedAt: cached.lastSyncedAt,
  });
  updateCurrentLedger(app, ledgers);
  return result;
}
const deleteLedger = (ledgerId) => mutateLedger("deleteLedger", ledgerId);
const removeLedgerMember = (targetOpenid, ledgerId) =>
  mutateLedger("removeLedgerMember", targetOpenid, ledgerId);
const updateBudget = (data) => mutateLedger("updateBudget", data);
const updateQuickAmounts = (data) => mutateLedger("updateQuickAmounts", data);
const updateAccounts = (data) => mutateLedger("updateAccounts", data);
const createLedgerInviteToken = (data) => mutateLedger("createLedgerInviteToken", data);
const joinLedgerByInviteToken = (inviteToken) =>
  mutateLedger("joinLedgerByInviteToken", inviteToken);
const joinLedger = (inviteCode) => mutateLedger("joinLedger", inviteCode);
const joinReadonlyLedger = (readonlyShareCode) =>
  mutateLedger("joinReadonlyLedger", readonlyShareCode);

function clearLedgers() {
  generation += 1;
  refreshRequest = null;
  syncRequest = null;
  wx.removeStorageSync(CACHE_KEY);
  const app = getAppInstance();
  if (app && app.globalData) app.globalData.ledgers = [];
}

module.exports = {
  DEFAULT_SYNC_INTERVAL_MS,
  getCachedLedgers,
  getLedgers,
  refreshLedgers,
  syncLedgers,
  subscribeSync,
  getLastSyncedAt,
  markSyncRequired,
  mutateLedger,
  createLedger,
  updateLedger,
  deleteLedger,
  removeLedgerMember,
  updateBudget,
  updateQuickAmounts,
  updateAccounts,
  createLedgerInviteToken,
  joinLedgerByInviteToken,
  joinLedger,
  joinReadonlyLedger,
  clearLedgers,
};
