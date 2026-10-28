const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const {
  shiftMonth,
  formatAnalysisRangeLabel,
} = require("../miniprogram/components/tl-tab-analysis/dates");
const {
  decorate,
  decorateCalendar,
} = require("../miniprogram/components/tl-tab-analysis/view-model");
const {
  getChartOption,
  hasChartData,
} = require("../miniprogram/components/tl-tab-analysis/chart-options");

test("analysis dates cross year boundaries and calendar preserves leap-day records", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(
    formatAnalysisRangeLabel("custom", "", "2024-02-01 至 2024-02-29"),
    "2024-02-01 至 2024-02-29"
  );
  const calendar = decorateCalendar(
    {
      range: { start: "2024-02-01" },
      calendarDays: [{ date: "2024-02-29", income: 100, expense: 25.5, recordCount: 2 }],
      calendarRecords: [
        { _id: "income", date: "2024-02-29", type: "income", amount: 100 },
        { _id: "expense", date: "2024-02-29", type: "expense", amount: 25.5, note: "午餐" },
      ],
    },
    "2024-02-29"
  );
  assert.equal(calendar.calendarCells.filter((cell) => !cell.blank).length, 29);
  assert.equal(calendar.calendarCells.filter((cell) => cell.blank).length, 4);
  assert.equal(calendar.selectedCalendarSummary.count, 2);
  assert.equal(calendar.selectedCalendarSummary.expenseText, "25.50");
  assert.equal(calendar.selectedCalendarRecords[1].noteText, "午餐");
  const nextMonth = decorateCalendar({ range: { start: "2024-03-01" } }, "2024-02-29");
  assert.equal(nextMonth.selectedCalendarDate, "2024-03-01");
  assert.deepEqual(nextMonth.selectedCalendarRecords, []);
});

test("analysis charts use supplied data for zero days, yearly extrema and negative balance", () => {
  const month = getChartOption({
    activeChart: "monthTrend",
    trend: [
      { label: "1日", expense: 0 },
      { label: "2日", expense: 20 },
    ],
  });
  assert.deepEqual(month.series[0].data, [null, 20]);
  const cashflow = getChartOption({
    activeChart: "yearCashflow",
    trend: [
      { label: "1月", income: 10, expense: 0 },
      { label: "2月", income: 20, expense: 2 },
      { label: "3月", income: 30, expense: 8 },
    ],
  });
  assert.deepEqual(cashflow.series[0].data, [10, 20, 30]);
  assert.equal(cashflow.series[1].data[1].itemStyle.color, "#6f9ceb");
  assert.equal(cashflow.series[1].data[2].itemStyle.color, "#f5b04e");
  const data = {
    activeChart: "yearBalance",
    overview: { recordCount: 0 },
    recentYearTrend: [{ label: "2025", income: 0, expense: 3, balance: -3 }],
  };
  assert.equal(hasChartData(data, "yearBalance"), true);
  assert.equal(getChartOption(data).series[0].data[0].value, -3);
  assert.deepEqual(getChartOption(data).series[0].data[0].itemStyle.borderRadius, [0, 0, 6, 6]);
  const empty = decorate({});
  assert.deepEqual(empty.categories, []);
  assert.deepEqual(empty.insights, []);
  assert.equal(hasChartData(empty, "monthRatio"), false);
});

test("an older analysis response cannot replace a newer ledger selection", async () => {
  const filename = path.resolve("miniprogram/components/tl-tab-analysis/index.js");
  const requireFromComponent = createRequire(filename);
  const pending = [];
  let definition;
  vm.runInNewContext(fs.readFileSync(filename, "utf8").replace(/^import .*;\r?\n/, ""), {
    getApp: () => ({ globalData: {} }),
    require: (name) =>
      name.includes("ledger.service")
        ? { getAnalysis: () => new Promise((resolve) => pending.push(resolve)) }
        : requireFromComponent(name),
    Component: (value) => {
      definition = value;
    },
    console,
  });
  const instance = {
    ...definition.methods,
    data: { ...definition.data, ledgerId: "first", anchor: "2026-10" },
    isAttached: true,
    analysisRequestId: 0,
    secondaryCharts: {},
    selectComponent: () => null,
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  assert.deepEqual(Array.from(instance.data.monthlyTopRecords), []);
  assert.deepEqual(Array.from(instance.data.yearRankingRows), []);
  const first = instance.loadAnalysis();
  instance.data.ledgerId = "second";
  const second = instance.loadAnalysis();
  const result = (name, expense) => ({
    ledger: { name, type: "personal" },
    range: { label: "2026年10月" },
    overview: { recordCount: 1, expense },
  });
  pending[1](result("新账本", 20));
  await second;
  pending[0](result("旧账本", 10));
  await first;
  assert.equal(instance.data.ledgerName, "新账本");
  assert.equal(instance.data.overview.expense, 20);
});
