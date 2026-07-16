const { execute } = require("../legacy.handlers");
const list = (context, payload) => execute("listCategories", context.openid, payload);
const save = (context, payload) => execute("saveCategory", context.openid, payload);
const remove = (context, payload) => execute("removeCategory", context.openid, payload);
module.exports = { list, save, remove };
