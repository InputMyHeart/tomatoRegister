const { execute } = require("../legacy.handlers");
const create = (context, payload) => execute("createLedger", context.openid, payload);
const list = (context, payload) => execute("listLedgers", context.openid, payload);
const setCurrent = (context, payload) => execute("setCurrentLedger", context.openid, payload);
const remove = (context, payload) => execute("deleteLedger", context.openid, payload);
const dashboard = (context, payload) => execute("getDashboard", context.openid, payload);
const updateBudget = (context, payload) => execute("updateBudget", context.openid, payload);
const updateMonthStartDay = (context, payload) =>
  execute("updateMonthStartDay", context.openid, payload);
module.exports = { create, list, setCurrent, remove, dashboard, updateBudget, updateMonthStartDay };
