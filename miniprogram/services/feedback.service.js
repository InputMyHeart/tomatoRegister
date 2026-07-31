const { callApi } = require("./api");

function createFeedback(payload) {
  return callApi("feedback/create", payload);
}

function listFeedback() {
  return callApi("feedback/list");
}

module.exports = { createFeedback, listFeedback };
