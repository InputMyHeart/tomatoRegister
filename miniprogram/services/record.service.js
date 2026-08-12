const { callApi } = require("./api");
const ledgerStore = require("./ledger.store");

async function mutateRecord(route, payload) {
  const result = await callApi(route, payload);
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
const deleteRecord = (recordId) => mutateRecord("record/delete", { recordId });
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
