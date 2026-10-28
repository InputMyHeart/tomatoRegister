const { callApi } = require("./api");
const ledgerStore = require("./ledger.store");
const { emit } = require("../utils/event-bus");

async function mutateRecord(route, payload) {
  const result = await callApi(route, payload);
  emit("records:changed", { ledgerId: payload.ledgerId || "" });
  try {
    await ledgerStore.syncLedgers({ force: true });
  } catch (error) {
    ledgerStore.markSyncRequired();
    console.warn("record mutation succeeded but synchronization failed", route, error);
  }
  return result;
}

const createRecord = (data) => mutateRecord("record/create", data);
const getRecord = (recordId) => callApi("record/get", { recordId });
const listRecords = (data) => callApi("record/list", data);
const updateRecord = (data) => mutateRecord("record/update", data);
const deleteRecord = (data) =>
  mutateRecord("record/delete", typeof data === "string" ? { recordId: data } : data);
const importRecords = (data) => mutateRecord("record/import", data);
const getImportTemplate = () => callApi("record/import/template");

module.exports = {
  createRecord,
  getRecord,
  listRecords,
  updateRecord,
  deleteRecord,
  importRecords,
  getImportTemplate,
};
