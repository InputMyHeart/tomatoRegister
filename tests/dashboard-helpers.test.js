const test = require("node:test");
const assert = require("node:assert/strict");
const {
  loadAllMonthRecords,
  summarizeDashboardRecords,
} = require("../cloudfunctions/tomatoLedger/dashboard.helpers");

test("dashboard reads every month page before calculating totals", async () => {
  const records = [
    { _id: "income", type: "income", amount: 12981 },
    ...Array.from({ length: 49 }, (_, index) => ({
      _id: `first-${index}`,
      type: "expense",
      amount: index === 0 ? 13264.74 : 0,
      parentCategory: "餐饮",
    })),
    ...Array.from({ length: 21 }, (_, index) => ({
      _id: `later-${index}`,
      type: "expense",
      amount: index === 0 ? 3087 : 0,
      parentCategory: "交通",
    })),
  ];
  const cursors = [];
  const loaded = await loadAllMonthRecords((cursor, pageSize) => {
    cursors.push(cursor && cursor._id);
    const start = cursor ? records.findIndex((record) => record._id === cursor._id) + 1 : 0;
    return Promise.resolve(records.slice(start, start + pageSize));
  }, 50);
  const summary = summarizeDashboardRecords(loaded);

  assert.deepEqual(cursors, [null, "first-48"]);
  assert.equal(summary.recordCount, 71);
  assert.equal(summary.income, 12981);
  assert.equal(summary.expense, 16351.74);
  assert.equal(summary.balance, -3370.74);
  assert.equal(summary.largestExpense, 13264.74);
  assert.equal(summary.topExpenseCategory, "餐饮");
});

test("dashboard continues after a full page and handles an empty month", async () => {
  const records = Array.from({ length: 101 }, (_, index) => ({
    _id: String(index),
    type: "expense",
    amount: 1,
    categoryName: "日常",
  }));
  let calls = 0;
  const loaded = await loadAllMonthRecords((cursor, pageSize) => {
    calls += 1;
    return Promise.resolve(
      records.slice(
        cursor ? Number(cursor._id) + 1 : 0,
        (cursor ? Number(cursor._id) + 1 : 0) + pageSize
      )
    );
  });
  assert.equal(calls, 2);
  assert.equal(summarizeDashboardRecords(loaded).expense, 101);
  assert.deepEqual(summarizeDashboardRecords([]), {
    income: 0,
    expense: 0,
    balance: 0,
    recordCount: 0,
    expenseCount: 0,
    averageExpense: 0,
    largestExpense: 0,
    saveRateAvailable: false,
    saveRate: 0,
    topExpenseCategory: "其他",
  });
});
