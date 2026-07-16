const { callApi } = require("./api");

const createRecord = (data) => callApi("record/create", data);
const getRecord = (recordId) => callApi("record/get", { recordId });
const listRecords = (data) => callApi("record/list", data);
const updateRecord = (data) => callApi("record/update", data);
const deleteRecord = (recordId) => callApi("record/delete", { recordId });

module.exports = { createRecord, getRecord, listRecords, updateRecord, deleteRecord };
