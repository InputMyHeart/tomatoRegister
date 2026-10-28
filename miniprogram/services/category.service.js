const { callApi } = require("./api");
const ledgerStore = require("./ledger.store");
const categoryStore = require("./category.store");
const { emit } = require("../utils/event-bus");

// 有效缓存立即返回；冷启动、过期或失效时等待云端分类。
const listCategories = (ledgerId) => categoryStore.getCategories(ledgerId);

async function mutateCategory(route, payload) {
  const result = await callApi(route, payload);
  categoryStore.invalidate(payload.ledgerId);
  emit("records:changed", { ledgerId: payload.ledgerId });
  try {
    await ledgerStore.syncLedgers({ force: true });
  } catch (error) {
    ledgerStore.markSyncRequired();
    console.warn("category mutation succeeded but synchronization failed", route, error);
  }
  categoryStore.refreshCategories(payload.ledgerId, { force: true }).catch(() => {});
  return result;
}

const saveCategory = (data) => mutateCategory("category/save", data);
const removeCategory = (categoryId, ledgerId) =>
  mutateCategory("category/delete", { categoryId, ledgerId });

module.exports = { listCategories, saveCategory, removeCategory };
