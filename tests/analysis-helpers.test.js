const test = require("node:test");
const assert = require("node:assert/strict");
const {
  collapseRanking,
  makeComparison,
  makeTrendBuckets,
  summarizeRecords,
} = require("../cloudfunctions/tomatoLedger/analysis.helpers");

test("monthly analysis fills leap-year days and keeps zero buckets", () => {
  const trend = makeTrendBuckets(
    "month",
    { start: "2024-02-01", end: "2024-03-01" },
    [{ date: "2024-02-29", type: "expense", amount: 88.5 }]
  );

  assert.equal(trend.length, 29);
  assert.deepEqual(trend[0], {
    key: "2024-02-01",
    label: "1日",
    income: 0,
    expense: 0,
    balance: 0,
  });
  assert.equal(trend[28].expense, 88.5);
  assert.equal(trend[28].balance, -88.5);
});

test("yearly and all-time analysis fill stable time buckets", () => {
  const yearly = makeTrendBuckets(
    "year",
    { start: "2026-01-01", end: "2027-01-01" },
    [{ date: "2026-08-13", type: "income", amount: 100 }]
  );
  assert.equal(yearly.length, 12);
  assert.equal(yearly[7].income, 100);

  const allTime = makeTrendBuckets("all", {}, [
    { date: "2022-01-01", type: "expense", amount: 10 },
    { date: "2024-01-01", type: "income", amount: 30 },
  ]);
  assert.deepEqual(
    allTime.map((item) => item.key),
    ["2022", "2023", "2024"]
  );
});

test("analysis overview and comparison handle expense-only periods", () => {
  const current = summarizeRecords([
    { type: "expense", amount: 10 },
    { type: "expense", amount: 25 },
  ]);
  const previous = summarizeRecords([{ type: "expense", amount: 20 }]);
  const comparison = makeComparison(current, previous, true);

  assert.equal(current.balance, -35);
  assert.equal(current.averageExpense, 17.5);
  assert.equal(current.largestExpense, 25);
  assert.equal(current.saveRateAvailable, false);
  assert.equal(current.saveRate, 0);
  assert.equal(comparison.expense.delta, 15);
  assert.equal(comparison.expense.rate, 75);
});

test("chart ranking keeps top five and combines the remainder", () => {
  const rows = [60, 50, 40, 30, 20, 10, 5].map((amount, index) => ({
    name: `分类${index + 1}`,
    amount,
    rate: 0,
  }));
  const ranking = collapseRanking(rows);

  assert.equal(ranking.length, 6);
  assert.equal(ranking[5].name, "其余分类");
  assert.equal(ranking[5].amount, 15);
  assert.equal(ranking[5].rate, 7);
});
