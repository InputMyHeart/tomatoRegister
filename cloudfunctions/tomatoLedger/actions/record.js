const { execute } = require("../legacy.handlers");
const create = (context, payload) => execute("createRecord", context.openid, payload);
const get = (context, payload) => execute("getRecord", context.openid, payload);
const list = (context, payload) => execute("listRecords", context.openid, payload);
const update = (context, payload) => execute("updateRecord", context.openid, payload);
const remove = (context, payload) => execute("deleteRecord", context.openid, payload);
module.exports = { create, get, list, update, remove };
