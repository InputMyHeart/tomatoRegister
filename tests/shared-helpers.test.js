const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

test("cloud helpers keep database primitives available to login handlers", () => {
  const originalLoad = Module._load;
  const command = { aggregate: {} };
  const db = { command, collection: () => ({}) };
  let initCount = 0;
  Module._load = function load(request, parent, isMain) {
    if (request === "wx-server-sdk") {
      return {
        DYNAMIC_CURRENT_ENV: "test",
        init: () => {
          initCount += 1;
        },
        database: () => db,
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  let helpers;
  try {
    helpers = require("../cloudfunctions/tomatoLedger/shared/helpers");
  } finally {
    Module._load = originalLoad;
  }

  assert.equal(helpers.db, db);
  assert.equal(helpers._, command);
  assert.equal(helpers.$, command.aggregate);
  assert.equal(typeof helpers.getUser, "function");
  assert.equal(initCount, 1);
});
