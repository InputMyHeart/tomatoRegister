const { execute } = require("../legacy.handlers");
const login = (context, payload) => execute("login", context.openid, payload);
const updateProfile = (context, payload) => execute("updateProfile", context.openid, payload);
const resetDatabase = (context, payload) => execute("resetDatabase", context.openid, payload);
module.exports = { login, updateProfile, resetDatabase };
