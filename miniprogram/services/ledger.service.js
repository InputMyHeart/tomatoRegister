const { callApi } = require("./api");

const createLedger = (data) => callApi("ledger/create", data);
const listLedgers = () => callApi("ledger/list");
const setCurrentLedger = (ledgerId) => callApi("ledger/current/set", { ledgerId });
const deleteLedger = (ledgerId) => callApi("ledger/delete", { ledgerId });
const getDashboard = (ledgerId) => callApi("ledger/dashboard/get", { ledgerId });
const getAnalysis = (data) => callApi("ledger/analysis/get", data);
const updateBudget = (data) => callApi("ledger/budget/update", data);
const updateMonthStartDay = (data) => callApi("ledger/month-start/update", data);
const createLedgerInviteToken = (data) => callApi("invite/create", data);
const joinLedgerByInviteToken = (inviteToken) => callApi("invite/join-token", { inviteToken });
const joinLedger = (inviteCode) => callApi("invite/join", { inviteCode });
const joinReadonlyLedger = (readonlyShareCode) =>
  callApi("invite/join-readonly", { readonlyShareCode });

module.exports = {
  createLedger,
  listLedgers,
  setCurrentLedger,
  deleteLedger,
  getDashboard,
  getAnalysis,
  updateBudget,
  updateMonthStartDay,
  createLedgerInviteToken,
  joinLedgerByInviteToken,
  joinLedger,
  joinReadonlyLedger,
};
