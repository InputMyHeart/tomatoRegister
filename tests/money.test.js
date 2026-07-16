const test = require("node:test");
const assert = require("node:assert/strict");
const {
  toNumber,
  roundMoney,
  formatMoney,
  formatDisplayMoney,
} = require("../miniprogram/utils/money");
test("money normalizes and formats values", () => {
  assert.equal(toNumber("12.5"), 12.5);
  assert.equal(toNumber("invalid", 7), 7);
  assert.equal(roundMoney(1.005), 1);
  assert.equal(formatMoney(12.5), "12.50");
  assert.equal(formatMoney(12.5, { sign: true }), "+12.50");
  assert.equal(formatDisplayMoney(12), "12");
});
