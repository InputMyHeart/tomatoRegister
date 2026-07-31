const ledgerService = require("./ledger.service");

const CACHE_KEY = "tomatoLedgerLedgerCache";
let refreshRequest = null;

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

function readCache(appInstance) {
  const cached = wx.getStorageSync(CACHE_KEY);
  const scope = getScope(appInstance);
  if (!scope || !cached || cached.scope !== scope || !Array.isArray(cached.ledgers)) return [];
  return cached.ledgers;
}

function writeCache(ledgers) {
  const app = getAppInstance();
  const scope = getScope();
  if (!scope) return;
  const rows = Array.isArray(ledgers) ? ledgers : [];
  wx.setStorageSync(CACHE_KEY, { scope, ledgers: rows, updatedAt: Date.now() });
  if (app && app.globalData) app.globalData.ledgers = rows;
}

function getCachedLedgers(appInstance) {
  const app = getAppInstance(appInstance);
  const ledgers = readCache(app);
  if (app && app.globalData) app.globalData.ledgers = ledgers;
  return ledgers;
}

async function refreshLedgers() {
  if (refreshRequest) return refreshRequest;
  refreshRequest = ledgerService
    .listLedgers()
    .then((data) => {
      const ledgers = data.ledgers || [];
      writeCache(ledgers);
      return ledgers;
    })
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}

async function getLedgers() {
  const cached = getCachedLedgers();
  return cached.length ? cached : refreshLedgers();
}

function clearLedgers() {
  wx.removeStorageSync(CACHE_KEY);
  const app = getAppInstance();
  if (app && app.globalData) app.globalData.ledgers = [];
}

module.exports = { getCachedLedgers, getLedgers, refreshLedgers, clearLedgers };
