const ledgerStore = require("./ledger.store");
const categoryStore = require("./category.store");

let syncRequest = null;
let syncOwner = "";

function scopeOf(app) {
  const data = app.globalData;
  return `${(data.environment || {}).key || ""}:${data.openid}:${app.authGeneration || 0}`;
}

// 无记录/分析结果缓存可清除；未显示的页面下次进入时直接读取云端。
async function syncData() {
  const app = getApp();
  if (!app.globalData.loggedIn) throw new Error("请先登录");
  const scope = scopeOf(app);
  if (syncRequest && syncOwner === scope) return syncRequest;
  syncOwner = scope;
  const request = (async () => {
    await app.loginWithWechat({ force: true });
    if (scope !== scopeOf(app)) throw new Error("登录状态已变化，请重试");
    const result = await ledgerStore.syncLedgers({ force: true, notify: false });
    categoryStore.invalidateAll();
    const ledgerId = (app.globalData.currentLedger || {})._id;
    if (ledgerId) await categoryStore.refreshCategories(ledgerId, { force: true });
    if (scope !== scopeOf(app)) throw new Error("登录状态已变化，请重试");
    const syncedAt = Date.now();
    app.globalData.dataSyncedAt = syncedAt;
    return { ...result, syncedAt };
  })();
  syncRequest = request;
  try {
    return await request;
  } finally {
    if (syncRequest === request) syncRequest = null;
  }
}

module.exports = { syncData };
