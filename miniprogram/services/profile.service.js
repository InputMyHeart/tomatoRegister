const { callApi } = require("./api");

function login() {
  return callApi("auth/login");
}

function updateProfile(profile) {
  return callApi("auth/profile/update", profile);
}

function resetDatabase() {
  return callApi("auth/database/reset", { confirm: "RESET_TOMATO_LEDGER_DATABASE" });
}

module.exports = { login, updateProfile, resetDatabase };
