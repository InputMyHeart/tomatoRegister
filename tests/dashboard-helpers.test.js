const test = require("node:test");
const assert = require("node:assert/strict");
const {
  loadAllMonthRecords,
  summarizeDashboardGroups,
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

test("dashboard grouped totals match the previous full-record summary", () => {
  const cases = [
    [],
    [{ type: "income", amount: 25 }],
    [{ type: "expense", amount: 12.34, categoryName: "餐饮" }],
    Array.from({ length: 101 }, (_, index) => ({
      type: index % 5 === 0 ? "income" : "expense",
      amount: index % 3 === 0 ? 12.34 : 0.01,
      parentCategory: index % 2 === 0 ? "餐饮" : "",
      categoryName: index % 2 === 0 ? "午餐" : "交通",
    })),
  ];
  cases.forEach((records) => {
    const types = new Map();
    const categories = new Map();
    records.forEach((record) => {
      const type = types.get(record.type) || {
        _id: record.type,
        total: 0,
        count: 0,
        largest: 0,
      };
      type.total += record.amount;
      type.count += 1;
      type.largest = Math.max(type.largest, record.amount);
      types.set(record.type, type);
      if (record.type === "expense") {
        const category = record.parentCategory || record.categoryName || "其他";
        categories.set(category, (categories.get(category) || 0) + record.amount);
      }
    });
    const topCategory = [...categories].sort((left, right) => right[1] - left[1])[0];
    const before = summarizeDashboardRecords(records);
    const after = summarizeDashboardGroups([...types.values()], topCategory && topCategory[0]);
    for (const field of [
      "income",
      "expense",
      "balance",
      "recordCount",
      "largestExpense",
      "topExpenseCategory",
    ]) {
      assert.equal(after[field], before[field], field);
    }
  });
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
