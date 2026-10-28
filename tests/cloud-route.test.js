const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
test("cloud entrypoint exposes required route protocol", () => {
  const source = fs.readFileSync("cloudfunctions/tomatoLedger/index.js", "utf8");
  for (const route of [
    "auth/login",
    "ledger/create",
    "ledger/update",
    "ledger/sync",
    "ledger/accounts/update",
    "record/list",
    "category/delete",
    "invite/join-token",
  ])
    assert.match(source, new RegExp('"' + route + '"'));
  assert.doesNotMatch(source, /"auth\/database\/reset"/);
  assert.doesNotMatch(source, /event\.action|event\.type/);
});

test("cloud entrypoint preserves handler success and failure results", async () => {
  const source = fs.readFileSync("cloudfunctions/tomatoLedger/index.js", "utf8");
  let handlerResult = { success: true, data: { loggedIn: true } };
  const handler = new Proxy({}, { get: () => async () => handlerResult });
  const cloud = {
    DYNAMIC_CURRENT_ENV: "test",
    init() {},
    database: () => ({ collection: () => ({ add: async () => ({}) }) }),
    getWXContext: () => ({ OPENID: "test-user" }),
  };
  const modules = {
    "wx-server-sdk": cloud,
    "./shared/response": {
      success: (data) => ({ ok: true, data }),
      failure: (code, message) => ({ ok: false, error: { code, message } }),
    },
    "./shared/errors": { toFailure: (error) => ({ code: error.code, message: error.message }) },
    "./validators/schemas": { assertObject() {} },
    "./shared/helpers": { ensureCollections: async () => {} },
    "./actions/feedback": { create: handler.login, list: handler.login },
  };
  for (const name of [
    "auth",
    "ledger",
    "record",
    "category",
    "dashboard",
    "analysis",
    "budget",
    "settings",
  ]) {
    modules[`./handlers/${name}.handler`] = handler;
  }
  const context = {
    require: (name) => modules[name],
    exports: {},
    console: { info() {}, warn() {}, error() {} },
    Date,
    Math,
  };
  vm.runInNewContext(source, context);

  const success = await context.exports.main({ route: "auth/login", payload: {} });
  assert.equal(success.ok, true);
  assert.equal(success.data.loggedIn, true);

  handlerResult = { success: false, code: "LOGIN_DENIED", message: "登录失败" };
  const failure = await context.exports.main({ route: "auth/login", payload: {} });
  assert.equal(failure.ok, false);
  assert.equal(failure.error.code, "LOGIN_DENIED");
  assert.equal(failure.error.message, "登录失败");
});
