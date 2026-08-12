const { callApi } = require("./api");
const ledgerStore = require("./ledger.store");

const listCategories = (ledgerId) => callApi("category/list", { ledgerId });
async function mutateCategory(route, payload) {
  const result = await callApi(route, payload);
  try {
    await ledgerStore.syncLedgers({ force: true });
  } catch (error) {
    ledgerStore.markSyncRequired();
    console.warn("category mutation succeeded but synchronization failed", route, error);
  }
  return result;
}

const saveCategory = (data) => mutateCategory("category/save", data);
const removeCategory = (categoryId, ledgerId) =>
  mutateCategory("category/delete", { categoryId, ledgerId });

module.exports = { listCategories, saveCategory, removeCategory };
