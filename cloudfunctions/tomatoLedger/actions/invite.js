const { execute } = require("../legacy.handlers");
const create = (context, payload) => execute("createLedgerInviteToken", context.openid, payload);
const joinByToken = (context, payload) =>
  execute("joinLedgerByInviteToken", context.openid, payload);
const join = (context, payload) => execute("joinLedger", context.openid, payload);
const joinReadonly = (context, payload) => execute("joinReadonlyLedger", context.openid, payload);
module.exports = { create, joinByToken, join, joinReadonly };
