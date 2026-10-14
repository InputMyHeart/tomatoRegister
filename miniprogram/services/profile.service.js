const { callApi } = require("./api");

function login() {
  return callApi("auth/login");
}

function updateProfile(profile) {
  return callApi("auth/profile/update", profile);
}

module.exports = { login, updateProfile };
