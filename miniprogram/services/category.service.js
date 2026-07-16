const { callApi } = require("./api");

const listCategories = (ledgerId) => callApi("category/list", { ledgerId });
const saveCategory = (data) => callApi("category/save", data);
const removeCategory = (categoryId, ledgerId) =>
  callApi("category/delete", { categoryId, ledgerId });

module.exports = { listCategories, saveCategory, removeCategory };
