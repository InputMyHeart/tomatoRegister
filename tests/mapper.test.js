const test = require("node:test");
const assert = require("node:assert/strict");
const { getId, getLedgerRole, normalizeLedger } = require("../miniprogram/utils/mapper");
test("mapper resolves ids and ledger roles", () => {
  assert.equal(getId({ _id: "a", id: "b" }), "a");
  assert.equal(getLedgerRole("u1", { ownerOpenid: "u1" }), "owner");
  assert.equal(getLedgerRole("u1", { viewerOpenids: ["u1"] }), "readonly");
  assert.equal(normalizeLedger({ _id: "l1", memberOpenids: ["u1"] }, "u1").id, "l1");
});
