const { callApi } = require("./api");

const createLedger = (data) => callApi("ledger/create", data);
const listLedgers = () => callApi("ledger/list");
const setCurrentLedger = (ledgerId) => callApi("ledger/current/set", { ledgerId });
const deleteLedger = (ledgerId) => callApi("ledger/delete", { ledgerId });
const getLedgerMembers = (ledgerId) => callApi("ledger/members/get", { ledgerId });
const removeLedgerMember = (targetOpenid, ledgerId) =>
  callApi("ledger/members/remove", { targetOpenid, ledgerId });
const getDashboard = (ledgerId) => callApi("ledger/dashboard/get", { ledgerId });
const getAnalysis = (data) => callApi("ledger/analysis/get", data);
const updateBudget = (data) => callApi("ledger/budget/update", data);
const updateQuickAmounts = (data) => callApi("ledger/quick-amounts/update", data);
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
  getLedgerMembers,
  removeLedgerMember,
  getDashboard,
  getAnalysis,
  updateBudget,
  updateQuickAmounts,
  createLedgerInviteToken,
  joinLedgerByInviteToken,
  joinLedger,
  joinReadonlyLedger,
};
