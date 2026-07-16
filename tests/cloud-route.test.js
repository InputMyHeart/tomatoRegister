const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
test("cloud entrypoint exposes required route protocol", () => {
  const source = fs.readFileSync("cloudfunctions/tomatoLedger/index.js", "utf8");
  for (const route of [
    "auth/login",
    "ledger/create",
    "record/list",
    "category/delete",
    "invite/join-token",
  ])
    assert.match(source, new RegExp('"' + route + '"'));
  assert.doesNotMatch(source, /event\.action|event\.type/);
});
