const { execute } = require("../legacy.handlers");
const create = (context, payload) => execute("createLedger", context.openid, payload);
const update = (context, payload) => execute("updateLedger", context.openid, payload);
const list = (context, payload) => execute("listLedgers", context.openid, payload);
const sync = (context, payload) => execute("syncLedgers", context.openid, payload);
const setCurrent = (context, payload) => execute("setCurrentLedger", context.openid, payload);
const members = (context, payload) => execute("getLedgerMembers", context.openid, payload);
const removeMember = (context, payload) => execute("removeLedgerMember", context.openid, payload);
const remove = (context, payload) => execute("deleteLedger", context.openid, payload);
const dashboard = (context, payload) => execute("getDashboard", context.openid, payload);
const analysis = (context, payload) => execute("getAnalysis", context.openid, payload);
const updateBudget = (context, payload) => execute("updateBudget", context.openid, payload);
const updateQuickAmounts = (context, payload) =>
  execute("updateQuickAmounts", context.openid, payload);
const updateAccounts = (context, payload) => execute("updateAccounts", context.openid, payload);
module.exports = {
  create,
  update,
  list,
  sync,
  setCurrent,
  members,
  removeMember,
  remove,
  dashboard,
  analysis,
  updateBudget,
  updateQuickAmounts,
  updateAccounts,
};
