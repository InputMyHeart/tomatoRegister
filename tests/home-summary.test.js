const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const money = require("../miniprogram/utils/money");

test("home shows expense placeholders for empty and income-only months", () => {
  const context = {
    getApp: () => ({}),
    require: (name) => (name.endsWith("/money") ? money : {}),
    Component() {},
  };
  vm.runInNewContext(
    fs.readFileSync("miniprogram/components/tl-tab-home/index.js", "utf8"),
    context
  );
  for (const recordCount of [0, 2]) {
    const data = context.normalizeDashboard({
      recordCount,
      monthExpense: 0,
      topExpenseCategory: "其他",
      largestExpenseAmount: 0,
    });
    assert.equal(data.hasMonthExpense, false);
    assert.equal(data.topExpenseCategory, "-");
    assert.equal(data.largestExpenseCompact, "-");
  }
  const data = context.normalizeDashboard({
    recordCount: 3,
    monthExpense: 50,
    topExpenseCategory: "餐饮",
    largestExpenseAmount: 39,
  });
  assert.equal(data.hasMonthExpense, true);
  assert.equal(data.topExpenseCategory, "餐饮");
  assert.equal(data.largestExpenseCompact, "39");
});
