// 分类变化少，保留按环境、账号隔离的本地缓存；请求结果只允许写回原会话。
const { callApi } = require("./api");

const CACHE_KEY = "tomatoLedgerCategoryCache";
const DEFAULT_SYNC_INTERVAL_MS = 2 * 60 * 1000;
const memoryCache = {};
const syncListeners = new Set();
let activeScope = "";
let generation = 0;

function getScope() {
  const app = getApp();
  const data = (app && app.globalData) || {};
  return data.openid ? `${(data.environment || {}).key || "default"}:${data.openid}` : "";
}

function ensureScope() {
  const scope = getScope();
  if (scope !== activeScope) {
    Object.keys(memoryCache).forEach((key) => delete memoryCache[key]);
    activeScope = scope;
    generation += 1;
  }
  return scope;
}

function readCacheRecord() {
  const scope = ensureScope();
  const cached = wx.getStorageSync(CACHE_KEY);
  return scope && cached && cached.scope === scope ? cached : null;
}

function ensureMemory(ledgerId) {
  ensureScope();
  if (memoryCache[ledgerId]) return memoryCache[ledgerId];
  const cached = readCacheRecord();
  const saved = cached && cached.ledgers && cached.ledgers[ledgerId];
  if (saved) memoryCache[ledgerId] = { ...saved, refreshPromise: null };
  return memoryCache[ledgerId] || null;
}

function subscribeSync(listener) {
  if (typeof listener !== "function") return () => {};
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function emitSync(result) {
  syncListeners.forEach((listener) => {
    try {
      listener(result);
    } catch (error) {
      console.warn("category sync listener failed", error);
    }
  });
}

function getCategoriesSync(ledgerId) {
  const entry = ledgerId && ensureMemory(ledgerId);
  return entry && entry.lastSyncedAt ? entry.items : [];
}

async function refreshCategories(ledgerId, options = {}) {
  if (!ledgerId) return [];
  const scope = ensureScope();
  const requestGeneration = generation;
  if (!scope) throw new Error("请先登录");
  let entry = ensureMemory(ledgerId);
  if (entry && entry.refreshPromise) {
    if (!options.force) return entry.refreshPromise;
    try {
      await entry.refreshPromise;
    } catch (_error) {
      // 手动刷新仍要重试失败的旧请求。
    }
    if (scope !== getScope() || requestGeneration !== generation)
      throw new Error("登录状态已变化，请重试");
    return refreshCategories(ledgerId);
  }
  entry = entry || { items: [], lastSyncedAt: 0, refreshPromise: null };
  memoryCache[ledgerId] = entry;
  const promise = callApi("category/list", { ledgerId })
    .then((data) => {
      if (
        scope !== getScope() ||
        requestGeneration !== generation ||
        memoryCache[ledgerId] !== entry
      ) {
        throw new Error("分类状态已变化，请重试");
      }
      const items = data.categories || [];
      const root = readCacheRecord() || { scope, ledgers: {} };
      const lastSyncedAt = Date.now();
      root.ledgers = root.ledgers || {};
      root.ledgers[ledgerId] = { items, lastSyncedAt };
      root.updatedAt = lastSyncedAt;
      wx.setStorageSync(CACHE_KEY, root);
      entry.items = items;
      entry.lastSyncedAt = lastSyncedAt;
      emitSync({ ledgerId, items, changed: true });
      return items;
    })
    .finally(() => {
      if (entry.refreshPromise === promise) entry.refreshPromise = null;
    });
  entry.refreshPromise = promise;
  return promise;
}

async function getCategories(ledgerId, options = {}) {
  if (!ledgerId) return [];
  const entry = ensureMemory(ledgerId);
  // 冷启动等待真实分类，不能把未加载误认为没有分类。
  if (!entry || !entry.lastSyncedAt) return refreshCategories(ledgerId, options);
  if (options.force || Date.now() - entry.lastSyncedAt > DEFAULT_SYNC_INTERVAL_MS) {
    return refreshCategories(ledgerId, options);
  }
  return entry.items;
}

function invalidate(ledgerId) {
  if (!ledgerId) return;
  ensureScope();
  delete memoryCache[ledgerId];
  const root = readCacheRecord();
  if (root && root.ledgers && root.ledgers[ledgerId]) {
    root.ledgers[ledgerId].lastSyncedAt = 0;
    wx.setStorageSync(CACHE_KEY, root);
  }
  emitSync({ ledgerId, invalidated: true });
}

function invalidateAll() {
  const root = readCacheRecord();
  const ids = new Set([...Object.keys(memoryCache), ...Object.keys((root && root.ledgers) || {})]);
  ids.forEach(invalidate);
}

function removeLedger(ledgerId) {
  ensureScope();
  delete memoryCache[ledgerId];
  const root = readCacheRecord();
  if (root && root.ledgers) {
    delete root.ledgers[ledgerId];
    wx.setStorageSync(CACHE_KEY, root);
  }
}

function clearAll() {
  Object.keys(memoryCache).forEach((key) => delete memoryCache[key]);
  generation += 1;
  activeScope = "";
  wx.removeStorageSync(CACHE_KEY);
}

module.exports = {
  DEFAULT_SYNC_INTERVAL_MS,
  getCategoriesSync,
  getCategories,
  refreshCategories,
  invalidate,
  invalidateAll,
  removeLedger,
  subscribeSync,
  clearAll,
};
