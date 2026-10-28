const { formatDisplayMoney } = require("../../utils/money");
const {
  monthAnchor,
  dateAnchor,
  isCurrentMonthAnchor,
  isCurrentYearAnchor,
  getCalendarSelectedDate,
  formatCalendarDateLabel,
} = require("./dates");

function amount(value) {
  return Number(value || 0);
}

function money(value) {
  return `¥${formatDisplayMoney(value)}`;
}

function comparisonText(comparison = {}, metric) {
  if (!comparison.enabled) return "";
  const item = comparison[metric] || {};
  if (item.direction === "flat") return "持平";
  if (item.rate === null) return item.direction === "up" ? "上期为 0" : "本期归零";
  return `${item.direction === "up" ? "↑" : "↓"} ${Math.abs(item.rate)}%`;
}

function comparisonLabel(mode, anchor) {
  if (mode === "month") return isCurrentMonthAnchor(anchor) ? "较上月同期" : "较上月";
  if (mode === "year") return isCurrentYearAnchor(anchor) ? "较去年同期" : "较去年";
  return "";
}

function decorateRanking(rows = []) {
  return rows.map((item, index) => ({
    ...item,
    rank: index + 1,
    amountText: formatDisplayMoney(item.amount),
    barStyle: `width: ${Math.max(4, Math.min(100, Number(item.rate || 0)))}%`,
  }));
}

function decorateTrend(rows = []) {
  return rows.map((item) => ({
    ...item,
    incomeText: formatDisplayMoney(item.income),
    expenseText: formatDisplayMoney(item.expense),
    balanceText: formatDisplayMoney(item.balance),
  }));
}

function decorateTopExpenseRecords(records = []) {
  return records.map((item) => ({
    ...item,
    categoryText: item.categoryName || "其他",
    categoryIcon: item.categoryIcon || "bill-line",
    amountText: formatDisplayMoney(item.amount),
    account: item.account || "未设置账户",
    timeText: item.date
      ? `${Number(item.date.slice(5, 7))} 月 ${Number(item.date.slice(8, 10))} 日`
      : "",
    noteText: item.note || "未填写备注",
  }));
}

function getDetailRows(data, chartType) {
  if (chartType === "trend") return decorateTrend(data.trend || []);
  const rows =
    chartType === "category"
      ? data.categories
      : chartType === "income"
        ? data.incomeCategories
        : getRanking(data, chartType);
  return decorateRanking(rows || []);
}

function summarizeCalendarRecords(records = []) {
  return records.reduce(
    (summary, item) => {
      summary[item.type] += amount(item.amount);
      summary.count += 1;
      return summary;
    },
    { income: 0, expense: 0, count: 0 }
  );
}

function decorateCalendar(data = {}, selectedDate) {
  const range = data.range || {};
  const anchor = range.start ? range.start.slice(0, 7) : monthAnchor();
  const selected = getCalendarSelectedDate(anchor, selectedDate);
  const summaries = (data.calendarDays || []).reduce((result, item) => {
    result[item.date] = item;
    return result;
  }, {});
  const recordsByDate = (data.calendarRecords || []).reduce((result, item) => {
    result[item.date] = result[item.date] || [];
    result[item.date].push({
      ...item,
      amountText: formatDisplayMoney(item.amount),
      categoryText: item.categoryName || "\u5176\u4ed6",
      typeLabel: item.type === "income" ? "\u6536\u5165" : "\u652f\u51fa",
      iconName: item.categoryIcon || (item.type === "income" ? "wallet-3-line" : "bill-line"),
      metaText: item.account || "\u672a\u8bbe\u7f6e\u8d26\u6237",
      noteText: item.note || "",
      hasNote: Boolean(item.note),
    });
    return result;
  }, {});
  const firstDay = new Date(anchor + "-01T00:00:00").getDay();
  const days = new Date(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 0).getDate();
  const cells = Array.from({ length: firstDay }, (_, index) => ({
    key: "blank-" + index,
    blank: true,
  }));
  for (let day = 1; day <= days; day += 1) {
    const date = anchor + "-" + String(day).padStart(2, "0");
    const item = summaries[date] || {};
    cells.push({
      key: date,
      date,
      day,
      isStriped: Math.floor((firstDay + day - 1) / 7) % 2 === 1,
      incomeText: formatDisplayMoney(item.income),
      expenseText: formatDisplayMoney(item.expense),
      hasIncome: Number(item.income || 0) > 0,
      hasExpense: Number(item.expense || 0) > 0,
      hasRecords: Number(item.recordCount || 0) > 0,
      isActive: date === selected,
      isToday: date === dateAnchor(),
    });
  }
  const selectedRecords = recordsByDate[selected] || [];
  const selectedSummary = summarizeCalendarRecords(selectedRecords);
  return {
    calendarAnchor: anchor,
    selectedCalendarDate: selected,
    calendarCells: cells,
    calendarRecordsByDate: recordsByDate,
    selectedCalendarRecords: selectedRecords,
    selectedCalendarDateLabel: formatCalendarDateLabel(selected),
    selectedCalendarSummary: {
      incomeText: formatDisplayMoney(selectedSummary.income),
      expenseText: formatDisplayMoney(selectedSummary.expense),
      count: selectedSummary.count,
    },
  };
}

function decorateInsightGroups(data = {}) {
  const groups = data.insightGroups || {};
  return {
    up: Array.isArray(groups.up) ? groups.up : [],
    down: Array.isArray(groups.down) ? groups.down : [],
    neutral: Array.isArray(groups.neutral)
      ? groups.neutral
      : Array.isArray(data.insights)
        ? data.insights
        : [],
  };
}

function decorate(data = {}) {
  const overview = data.overview || {};
  const budget = data.budget || {};
  const categoryChart = data.categoryChart || data.categories || [];
  const insightGroups = decorateInsightGroups(data);
  const saveRateText = overview.saveRateAvailable ? `储蓄率 ${overview.saveRate}%` : "暂无收入";
  return {
    ...data,
    overview: {
      ...overview,
      incomeText: formatDisplayMoney(overview.income),
      expenseText: formatDisplayMoney(overview.expense),
      balanceText: formatDisplayMoney(overview.balance),
      dailyExpenseText: formatDisplayMoney(overview.dailyExpense),
      averageExpenseText: formatDisplayMoney(overview.averageExpense),
      largestExpenseText: formatDisplayMoney(overview.largestExpense),
      saveRateText,
    },
    budget: {
      ...budget,
      amountText: formatDisplayMoney(budget.amount),
      spentText: formatDisplayMoney(budget.spent),
      remainingText: formatDisplayMoney(Math.abs(Number(budget.remaining || 0))),
    },
    comparison: data.comparison || { enabled: false },
    trend: data.trend || [],
    categories: decorateRanking(data.categories || []),
    categoryChart,
    incomeCategories: decorateRanking(data.incomeCategories || []),
    incomeCategoryChart: data.incomeCategoryChart || data.incomeCategories || [],
    accounts: decorateRanking(data.accounts || []),
    members: decorateRanking(data.members || []),
    insightGroups,
    insights: data.insights || [],
  };
}

function getRanking(data, chartType) {
  if (chartType === "category") return data.categoryChart || [];
  if (chartType === "income") return data.incomeCategoryChart || [];
  if (chartType === "account") return data.accounts || [];
  if (chartType === "member") return data.members || [];
  return [];
}

module.exports = {
  amount,
  money,
  comparisonText,
  comparisonLabel,
  decorateRanking,
  decorateTrend,
  decorateTopExpenseRecords,
  getDetailRows,
  summarizeCalendarRecords,
  decorateCalendar,
  decorateInsightGroups,
  decorate,
  getRanking,
};
