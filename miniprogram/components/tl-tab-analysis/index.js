import * as echarts from "../ec-canvas/echarts";

const app = getApp();
const ledgerService = require("../../services/ledger.service");
const ledgerStore = require("../../services/ledger.store");
const { formatDisplayMoney } = require("../../utils/money");

const CHART_META = {
  trend: { title: "收支趋势", subtitle: "收入、支出与结余随时间的变化" },
  category: { title: "支出构成", subtitle: "Top 5 支出分类，其余归入其他" },
  income: { title: "收入来源", subtitle: "各类收入在本期收入中的占比" },
  account: { title: "支付账户", subtitle: "支出按所选支付账户汇总" },
  member: { title: "成员录入支出", subtitle: "按记录创建者汇总，不代表实际付款人" },
  monthTrend: {
    title: "\u6d88\u8d39\u8d70\u52bf",
    subtitle: "\u6bcf\u65e5\u6d88\u8d39\u53d8\u5316",
  },
  monthRatio: {
    title: "\u652f\u51fa\u5360\u6bd4",
    subtitle: "\u5404\u7c7b\u652f\u51fa\u5728\u672c\u6708\u7684\u5360\u6bd4",
  },
  yearCashflow: {
    title: "\u6708\u5ea6\u6536\u652f",
    subtitle: "12 \u4e2a\u6708\u7684\u6536\u5165\u4e0e\u652f\u51fa",
  },
  yearBalance: {
    title: "\u7ed3\u4f59\u8d8b\u52bf",
    subtitle: "\u5305\u62ec\u5f53\u524d\u5e74\u7684\u6700\u8fd1 5 \u5e74\u7ed3\u4f59",
  },
  yearRatio: {
    title: "\u5168\u5e74\u652f\u51fa\u5360\u6bd4",
    subtitle: "\u5404\u7c7b\u652f\u51fa\u7684\u5360\u6bd4",
  },
};
const CHART_COLORS = ["#f0442f", "#ff8e67", "#f5b04e", "#25a66a", "#6f9ceb", "#9b7de5"];

function defaultChartForMode(mode) {
  if (mode === "month") return "monthTrend";
  if (mode === "year") return "yearCashflow";
  return "trend";
}

const ANALYSIS_CHART_TYPES = [
  "monthTrend",
  "monthRatio",
  "yearCashflow",
  "yearBalance",
  "yearRatio",
];
const MONTHLY_TOP_RECORDS = [
  {
    categoryText: "购物 · 数码设备",
    categoryIcon: "computer-line",
    amountText: "860",
    account: "微信支付",
    timeText: "8 月 15 日",
    noteText: "显示器支架",
  },
  {
    categoryText: "家居 · 厨房用品",
    categoryIcon: "home-8-line",
    amountText: "560",
    account: "支付宝",
    timeText: "8 月 5 日",
    noteText: "购置厨房收纳",
  },
  {
    categoryText: "餐饮 · 聚餐",
    categoryIcon: "restaurant-2-line",
    amountText: "316",
    account: "微信支付",
    timeText: "8 月 13 日",
    noteText: "朋友聚餐",
  },
  {
    categoryText: "购物 · 日用百货",
    categoryIcon: "shopping-bag-3-line",
    amountText: "238",
    account: "支付宝",
    timeText: "8 月 9 日",
    noteText: "补充日用品",
  },
  {
    categoryText: "餐饮 · 正餐",
    categoryIcon: "restaurant-2-line",
    amountText: "194",
    account: "微信支付",
    timeText: "8 月 16 日",
    noteText: "周末晚餐",
  },
  {
    categoryText: "交通 · 网约车",
    categoryIcon: "taxi-line",
    amountText: "172",
    account: "微信支付",
    timeText: "8 月 8 日",
    noteText: "下班打车",
  },
  {
    categoryText: "餐饮 · 快餐",
    categoryIcon: "restaurant-2-line",
    amountText: "128",
    account: "微信支付",
    timeText: "8 月 2 日",
    noteText: "工作日午餐",
  },
  {
    categoryText: "购物 · 日用百货",
    categoryIcon: "shopping-bag-3-line",
    amountText: "96",
    account: "支付宝",
    timeText: "8 月 17 日",
    noteText: "购置生活用品",
  },
  {
    categoryText: "餐饮 · 早餐",
    categoryIcon: "restaurant-2-line",
    amountText: "86",
    account: "现金",
    timeText: "8 月 1 日",
    noteText: "上班路上早餐",
  },
  {
    categoryText: "餐饮 · 快餐",
    categoryIcon: "restaurant-2-line",
    amountText: "48",
    account: "微信支付",
    timeText: "8 月 20 日",
    noteText: "工作日午餐",
  },
];

const YEAR_RANKINGS = {
  expense: [
    {
      rank: 1,
      name: "餐饮",
      amountText: "18,620",
      countText: "共 186 笔",
      changeText: "↓ 8.4%",
      changeClass: "is-down",
    },
    {
      rank: 2,
      name: "居住",
      amountText: "14,400",
      countText: "共 12 笔",
      changeText: "→ 0.6%",
      changeClass: "is-flat",
    },
    {
      rank: 3,
      name: "购物",
      amountText: "11,860",
      countText: "共 72 笔",
      changeText: "↑ 18.2%",
      changeClass: "is-up",
    },
    {
      rank: 4,
      name: "交通",
      amountText: "8,420",
      countText: "共 108 笔",
      changeText: "↓ 5.1%",
      changeClass: "is-down",
    },
    {
      rank: 5,
      name: "娱乐",
      amountText: "6,260",
      countText: "共 39 笔",
      changeText: "↑ 12.7%",
      changeClass: "is-up",
    },
    {
      rank: 6,
      name: "其他",
      amountText: "8,600",
      countText: "共 64 笔",
      changeText: "↓ 3.3%",
      changeClass: "is-down",
    },
  ],
  income: [
    {
      rank: 1,
      name: "工资",
      amountText: "57,600",
      countText: "共 8 笔",
      changeText: "↑ 6.8%",
      changeClass: "is-up",
    },
    {
      rank: 2,
      name: "奖金",
      amountText: "4,800",
      countText: "共 3 笔",
      changeText: "↑ 20.0%",
      changeClass: "is-up",
    },
    {
      rank: 3,
      name: "兼职",
      amountText: "1,240",
      countText: "共 11 笔",
      changeText: "↓ 4.6%",
      changeClass: "is-down",
    },
    {
      rank: 4,
      name: "理财",
      amountText: "500",
      countText: "共 5 笔",
      changeText: "→ 0.0%",
      changeClass: "is-flat",
    },
  ],
};

function monthAnchor() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateAnchor() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatAnalysisRangeLabel(mode, anchor, fallback = "") {
  if ((mode === "month" || mode === "calendar") && /^\d{4}-\d{2}$/.test(anchor)) {
    return `${anchor.slice(0, 4)}年${anchor.slice(5, 7)}月`;
  }
  if (mode === "year" && /^\d{4}$/.test(anchor)) return `${anchor}年`;
  return fallback;
}

function customRangeDefaults() {
  const end = dateAnchor();
  return { start: `${end.slice(0, 8)}01`, end };
}

function isCurrentMonthAnchor(anchor) {
  return anchor === monthAnchor();
}

function isCurrentYearAnchor(anchor) {
  return Number(anchor) === new Date().getFullYear();
}

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
        : getRanking({ data }, chartType);
  return decorateRanking(rows || []);
}

function shiftMonth(anchor, delta) {
  const [year, month] = String(anchor || monthAnchor())
    .split("-")
    .map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function getCalendarSelectedDate(anchor, selectedDate) {
  if (String(selectedDate || "").startsWith(anchor + "-")) return selectedDate;
  const today = dateAnchor();
  return today.startsWith(anchor + "-") ? today : anchor + "-01";
}

function formatCalendarDateLabel(date) {
  if (!date) return "";
  const parsed = new Date(date + "T00:00:00");
  const days = [
    "\u5468\u65e5",
    "\u5468\u4e00",
    "\u5468\u4e8c",
    "\u5468\u4e09",
    "\u5468\u56db",
    "\u5468\u4e94",
    "\u5468\u516d",
  ];
  return (
    Number(date.slice(5, 7)) +
    " \u6708 " +
    Number(date.slice(8, 10)) +
    " \u65e5 \u00b7 " +
    days[parsed.getDay()]
  );
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

function getRanking(page, chartType) {
  if (chartType === "category") return page.data.categoryChart || [];
  if (chartType === "income") return page.data.incomeCategoryChart || [];
  if (chartType === "account") return page.data.accounts || [];
  if (chartType === "member") return page.data.members || [];
  return [];
}

function formatTooltipAmount(value) {
  return money(Array.isArray(value) ? value[value.length - 1] : value);
}

function getPieOption(page, chartType) {
  const rows = getRanking(page, chartType);
  return {
    color: CHART_COLORS,
    animationDuration: 350,
    tooltip: {
      trigger: "item",
      triggerOn: "click",
      confine: true,
      formatter: (params) =>
        `${params.name}\n${formatTooltipAmount(params.value)} · ${params.percent}%`,
    },
    series: [
      {
        type: "pie",
        radius: ["48%", "72%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#fffaf7", borderWidth: 3 },
        label: { color: "#6e5a52", fontSize: 10, formatter: "{b}\n{d}%" },
        labelLine: { length: 10, length2: 8 },
        data: rows.map((item) => ({ name: item.name, value: amount(item.amount) })),
      },
    ],
  };
}

function getBarOption(page, chartType) {
  const rows = getRanking(page, chartType).slice(0, 8);
  return {
    color: [chartType === "income" ? "#25a66a" : "#f0442f"],
    animationDuration: 350,
    tooltip: {
      trigger: "axis",
      triggerOn: "click",
      confine: true,
      axisPointer: { type: "shadow" },
      formatter: (params) => `${params[0].name}\n${formatTooltipAmount(params[0].value)}`,
    },
    grid: { top: 12, right: 18, bottom: 12, left: 8, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { color: "#9a8278", fontSize: 9, formatter: (value) => `${value}` },
      splitLine: { lineStyle: { color: "#f4e9e4", type: "dashed" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: "#6f625d", fontSize: 10, width: 76, overflow: "truncate" },
      data: rows.map((item) => item.name),
    },
    series: [
      {
        type: "bar",
        barWidth: 14,
        itemStyle: { borderRadius: [0, 8, 8, 0] },
        data: rows.map((item) => amount(item.amount)),
      },
    ],
  };
}

function getTrendOption(page) {
  const trend = page.data.trend || [];
  return {
    color: ["#25a66a", "#f0442f", "#6f625d"],
    animationDuration: 350,
    tooltip: {
      trigger: "axis",
      triggerOn: "click",
      confine: true,
      formatter: (params) =>
        `${params[0].axisValue}\n${params.map((item) => `${item.seriesName} ${formatTooltipAmount(item.value)}`).join("\n")}`,
    },
    legend: {
      bottom: 0,
      data: ["收入", "支出", "结余"],
      textStyle: { color: "#8f766d", fontSize: 10 },
    },
    grid: { top: 20, right: 12, bottom: 44, left: 8, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#eadbd4" } },
      axisLabel: {
        color: "#9a8278",
        fontSize: 9,
        interval: page.data.mode === "month" ? 4 : "auto",
      },
      data: trend.map((item) => item.label),
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#9a8278", fontSize: 9 },
      splitLine: { lineStyle: { color: "#f4e9e4", type: "dashed" } },
    },
    series: [
      {
        name: "收入",
        type: "line",
        smooth: true,
        symbol: "circle",
        showSymbol: trend.length <= 12,
        symbolSize: 5,
        lineStyle: { width: 3 },
        data: trend.map((item) => amount(item.income)),
      },
      {
        name: "支出",
        type: "line",
        smooth: true,
        symbol: "circle",
        showSymbol: trend.length <= 12,
        symbolSize: 5,
        lineStyle: { width: 3 },
        data: trend.map((item) => amount(item.expense)),
      },
      {
        name: "结余",
        type: "line",
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2, type: "dashed" },
        data: trend.map((item) => amount(item.balance)),
      },
    ],
  };
}

function getMonthlyExpenseTrendOption(page) {
  const trend = page.data.trend || [];
  const expenses = trend.map((item) => amount(item.expense));
  const expenseDays = expenses.map((value) => (value > 0 ? value : null));
  return {
    color: ["#f0442f"],
    animationDuration: 350,
    tooltip: {
      trigger: "axis",
      triggerOn: "click",
      confine: true,
      formatter: (params) =>
        params[0].axisValue + "\n消费 " + formatTooltipAmount(params[0].value || 0),
    },
    grid: { top: 28, right: 18, bottom: 28, left: 10, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#eadbd4" } },
      axisLabel: { color: "#9a8278", fontSize: 9, interval: 4 },
      data: trend.map((item) => item.label),
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#9a8278", fontSize: 9 },
      splitLine: { lineStyle: { color: "#f4e9e4", type: "dashed" } },
    },
    series: [
      {
        name: "消费",
        type: "line",
        smooth: false,
        symbol: "circle",
        showSymbol: false,
        lineStyle: { width: 3 },
        itemStyle: { color: "#f0442f" },
        data: expenseDays,
        markPoint: {
          symbolSize: 42,
          label: { color: "#ffffff", fontSize: 9, formatter: "{b}" },
          data: [
            { type: "min", name: "最低", itemStyle: { color: "#25a66a" } },
            { type: "max", name: "最高", itemStyle: { color: "#f0442f" } },
          ],
        },
      },
    ],
  };
}

function getChartOption(page) {
  const chartType = page.data.activeChart;
  if (chartType === "monthTrend") return getMonthlyExpenseTrendOption(page);
  if (chartType === "monthRatio") return getPieOption(page, "category");
  if (chartType === "yearCashflow") return getAnalysisShowcaseChartOption(page, "year-cashflow");
  if (chartType === "yearBalance") return getAnalysisShowcaseChartOption(page, "year-balance");
  if (chartType === "yearRatio") return getAnalysisShowcaseChartOption(page, "year-ratio");
  if (["category", "income"].includes(chartType)) return getPieOption(page, chartType);
  if (["account", "member"].includes(chartType)) return getBarOption(page, chartType);
  return getTrendOption(page);
}

function getShowcaseChartOption(page, key) {
  const base = {
    animationDuration: 350,
    grid: { top: 20, right: 14, bottom: 26, left: 10, containLabel: true },
    xAxis: {
      type: "category",
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#eadbd4" } },
      axisLabel: { color: "#9a8278", fontSize: 9 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#9a8278", fontSize: 9 },
      splitLine: { lineStyle: { color: "#f4e9e4", type: "dashed" } },
    },
  };
  if (key === "month-category") return getPieOption(page, "category");
  if (key === "month-budget") {
    return {
      ...base,
      color: ["#f0442f", "#ffe1d6"],
      grid: { top: 12, right: 12, bottom: 14, left: 62, containLabel: true },
      xAxis: { type: "value", max: 100, show: false },
      yAxis: {
        type: "category",
        data: ["餐饮", "购物", "交通"],
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: "#6f625d", fontSize: 10 },
      },
      series: [
        {
          type: "bar",
          stack: "budget",
          barWidth: 14,
          itemStyle: { borderRadius: [8, 0, 0, 8] },
          data: [92, 98, 78],
        },
        {
          type: "bar",
          stack: "budget",
          barWidth: 14,
          itemStyle: { borderRadius: [0, 8, 8, 0] },
          data: [8, 2, 22],
        },
      ],
    };
  }
  if (key === "year-category") {
    return {
      ...base,
      color: ["#f0442f"],
      xAxis: { ...base.xAxis, data: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月"] },
      series: [
        {
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { width: 3 },
          areaStyle: { color: "rgba(240, 68, 47, 0.08)" },
          data: [420, 680, 760, 520, 980, 2860, 1040, 1700],
        },
      ],
    };
  }
  if (key === "calendar-week") {
    return {
      ...base,
      color: ["#f0442f"],
      xAxis: { ...base.xAxis, data: ["第 1 周", "第 2 周", "第 3 周", "第 4 周"] },
      series: [
        {
          type: "bar",
          barWidth: 24,
          itemStyle: { borderRadius: [8, 8, 0, 0] },
          data: [680, 896, 1548, 1258],
        },
      ],
    };
  }
  return getBarOption(page, "category");
}

function getAnalysisShowcaseChartOption(page, key) {
  const trend = page.data.trend || [];
  const base = {
    animationDuration: 350,
    grid: { top: 20, right: 14, bottom: 26, left: 10, containLabel: true },
    xAxis: {
      type: "category",
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#eadbd4" } },
      axisLabel: { color: "#9a8278", fontSize: 9 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#9a8278", fontSize: 9 },
      splitLine: { lineStyle: { color: "#f4e9e4", type: "dashed" } },
    },
  };
  if (key === "month-ratio") {
    return {
      color: ["#f0442f", "#25a66a"],
      animationDuration: 350,
      tooltip: {
        trigger: "item",
        triggerOn: "click",
        confine: true,
        formatter: "{b}\n\u00a5{c} \u00b7 {d}%",
      },
      legend: {
        bottom: 0,
        data: ["\u652f\u51fa", "\u6536\u5165"],
        textStyle: { color: "#8f766d", fontSize: 10 },
      },
      series: [
        {
          type: "pie",
          radius: ["52%", "72%"],
          center: ["50%", "44%"],
          itemStyle: { borderColor: "#fffaf7", borderWidth: 3 },
          label: { color: "#6e5a52", fontSize: 10, formatter: "{b}\n{d}%" },
          data: [
            { name: "\u652f\u51fa", value: amount(page.data.overview.expense) },
            { name: "\u6536\u5165", value: amount(page.data.overview.income) },
          ],
        },
      ],
    };
  }
  if (key === "year-ratio") return getPieOption(page, "category");
  if (key === "year-cashflow") {
    const expenseValues = trend.map((item) => amount(item.expense)).filter((value) => value > 0);
    const maxExpense = expenseValues.length ? Math.max(...expenseValues) : null;
    const minExpense = expenseValues.length ? Math.min(...expenseValues) : null;
    const expenseData = trend.map((item) => {
      const value = amount(item.expense);
      const color =
        value > 0 && value === maxExpense
          ? "#f5b04e"
          : value > 0 && value === minExpense
            ? "#6f9ceb"
            : "#f0442f";
      return { value, itemStyle: { color, borderRadius: [6, 6, 0, 0] } };
    });
    return {
      ...base,
      color: ["#25a66a", "#f0442f"],
      tooltip: {
        trigger: "axis",
        triggerOn: "click",
        confine: true,
        axisPointer: { type: "shadow" },
      },
      legend: {
        top: 0,
        data: ["\u6536\u5165", "\u652f\u51fa"],
        textStyle: { color: "#8f766d", fontSize: 10 },
      },
      grid: { top: 58, right: 14, bottom: 26, left: 10, containLabel: true },
      xAxis: { ...base.xAxis, data: trend.map((item) => item.label) },
      series: [
        {
          name: "\u6536\u5165",
          type: "bar",
          barWidth: 12,
          itemStyle: { borderRadius: [6, 6, 0, 0] },
          data: trend.map((item) => amount(item.income)),
        },
        {
          name: "\u652f\u51fa",
          type: "bar",
          barWidth: 12,
          barGap: "20%",
          data: expenseData,
        },
      ],
    };
  }
  if (key === "year-balance") {
    const recentYearTrend = page.data.recentYearTrend || [];
    return {
      ...base,
      color: ["#f0442f"],
      tooltip: {
        trigger: "axis",
        triggerOn: "click",
        confine: true,
        axisPointer: { type: "shadow" },
        formatter: (params) =>
          params[0].axisValue + "\n\u7ed3\u4f59 " + formatTooltipAmount(params[0].value),
      },
      grid: { top: 24, right: 14, bottom: 54, left: 10, containLabel: true },
      xAxis: {
        ...base.xAxis,
        axisLabel: {
          ...base.xAxis.axisLabel,
          interval: 0,
          rotate: 35,
          margin: 14,
        },
        data: recentYearTrend.map((item) => item.label),
      },
      series: [
        {
          name: "\u7ed3\u4f59",
          type: "bar",
          barWidth: 30,
          data: recentYearTrend.map((item) => {
            const value = amount(item.balance);
            return {
              value,
              itemStyle: {
                color: value < 0 ? "#6f9ceb" : "#f0442f",
                borderRadius: value < 0 ? [0, 0, 6, 6] : [6, 6, 0, 0],
              },
            };
          }),
        },
      ],
    };
  }
  if (key === "all-category") return getPieOption(page, "category");
  return getShowcaseChartOption(page, key);
}
function hasChartData(data, activeChart) {
  if (activeChart === "yearBalance") {
    return (data.recentYearTrend || []).some(
      (item) => amount(item.income) !== 0 || amount(item.expense) !== 0
    );
  }
  if (activeChart === "trend" || ANALYSIS_CHART_TYPES.includes(activeChart))
    return Boolean(data.overview && Number(data.overview.recordCount || 0) > 0);
  return Boolean(getRanking({ data }, activeChart).length);
}

Component({
  data: {
    ledgerId: "",
    ledgerName: "分析账本",
    ledgerType: "personal",
    ledgerOptions: [],
    mode: "month",
    modeOptions: [
      { value: "month", label: "\u6708\u5ea6" },
      { value: "year", label: "\u5e74\u5ea6" },
      { value: "calendar", label: "\u65e5\u5386" },
    ],
    modeIndex: 0,
    modeLabel: "\u6708\u5ea6",
    isModeSheetVisible: false,
    anchor: "",
    customStart: "",
    customEnd: "",
    rangeLabel: "",
    activeChart: "monthTrend",
    chartTitle: CHART_META.monthTrend.title,
    chartSubtitle: CHART_META.monthTrend.subtitle,
    hasChartData: false,
    hasRecords: false,
    ec: { disableTouch: false },
    loading: true,
    error: false,
    noLedger: false,
    isLedgerSwitcherVisible: false,
    isLoadingLedgers: false,
    ledgerLoadError: false,
    overview: {},
    comparison: { enabled: false },
    incomeCompareText: "",
    expenseCompareText: "",
    balanceCompareText: "",
    balanceComparisonText: "",
    comparisonLabel: "",
    budget: {},
    trend: [],
    categories: [],
    categoryChart: [],
    incomeCategories: [],
    incomeCategoryChart: [],
    accounts: [],
    members: [],
    activeRanking: [],
    activeDetailRows: [],
    hasDetailRows: false,
    hasInsights: false,
    insightGroups: { up: [], down: [], neutral: [] },
    insights: [],
    calendarAnchor: "",
    selectedCalendarDate: "",
    selectedCalendarDateLabel: "",
    calendarCells: [],
    calendarRecordsByDate: {},
    selectedCalendarRecords: [],
    monthlyTopRecords: MONTHLY_TOP_RECORDS.slice(0, 5),
    yearRankingType: "expense",
    yearRankingRows: YEAR_RANKINGS.expense,
    isQuestionDialogVisible: false,
    questionDialogTitle: "",
    questionDialogContent: "",
  },

  lifetimes: {
    attached() {
      this.isAttached = true;
      this.chart = null;
      this.showcaseCharts = {};
      this.analysisRequestId = 0;
      this.bootstrap();
    },
    detached() {
      this.isAttached = false;
      this.analysisRequestId += 1;
      this.disposeChart();
      this.disposeShowcaseCharts();
    },
  },

  methods: {
    refreshAnalysis(syncResult = {}) {
      const changedLedgerIds = syncResult.changedLedgerIds || [];
      const removedLedgerIds = syncResult.removedLedgerIds || [];
      if (removedLedgerIds.includes(this.data.ledgerId)) {
        const fallback = ledgerStore
          .getCachedLedgers()
          .find((ledger) => !removedLedgerIds.includes(ledger._id || ledger.id));
        if (!fallback) {
          this.analysisRequestId += 1;
          this.disposeChart();
          this.setData({
            ledgerId: "",
            ledgerName: "分析账本",
            loading: false,
            noLedger: true,
          });
          return;
        }
        this.setData({
          ledgerId: fallback._id || fallback.id,
          ledgerName: fallback.name || "分析账本",
          ledgerType: fallback.type || "personal",
          anchor: monthAnchor(),
          activeChart:
            (fallback.type || "personal") === "shared" || this.data.activeChart !== "member"
              ? this.data.activeChart
              : "trend",
        });
        return this.loadAnalysis();
      }
      if (changedLedgerIds.length && !changedLedgerIds.includes(this.data.ledgerId)) return;
      return this.loadAnalysis();
    },

    async bootstrap() {
      if (!app.globalData.loggedIn) return wx.reLaunch({ url: "/pages/login/index" });
      try {
        await app.loginWithWechat();
      } catch (error) {
        if (this.isAttached) {
          console.warn("analysis bootstrap failed", error);
          this.setData({ loading: false, error: true });
        }
        return;
      }
      if (!this.isAttached) return;
      const ledger = app.globalData.currentLedger || {};
      this.setData({
        ledgerId: ledger._id || "",
        ledgerName: ledger.name || "分析账本",
        ledgerType: ledger.type || "personal",
        anchor: monthAnchor(),
        ...(() => {
          const range = customRangeDefaults();
          return { customStart: range.start, customEnd: range.end };
        })(),
        noLedger: !ledger._id,
      });
      if (ledger._id) return this.loadAnalysis();
      this.setData({ loading: false });
    },

    async loadAnalysis() {
      if (!this.data.ledgerId) return this.setData({ loading: false, noLedger: true });
      const requestId = ++this.analysisRequestId;
      const request = {
        ledgerId: this.data.ledgerId,
        mode: this.data.mode,
        anchor: this.data.anchor,
        customStart: this.data.customStart,
        customEnd: this.data.customEnd,
      };
      this.disposeChart();
      this.disposeShowcaseCharts();
      this.setData({ loading: true, error: false, noLedger: false, hasChartData: false });
      try {
        const result = decorate(await ledgerService.getAnalysis(request));
        if (!this.isAttached || requestId !== this.analysisRequestId) return;
        if (result.noLedger || !result.ledger) {
          this.setData({ loading: false, noLedger: true });
          return;
        }
        const chartType =
          this.data.activeChart === "member" && result.ledger.type !== "shared"
            ? "trend"
            : this.data.activeChart;
        const meta = CHART_META[chartType];
        const activeDetailRows = getDetailRows(result, chartType);
        const calendarData =
          request.mode === "calendar"
            ? decorateCalendar(result, this.data.selectedCalendarDate)
            : {};
        const nextData = {
          ...result,
          ...calendarData,
          loading: false,
          ledgerName: result.ledger.name,
          ledgerType: result.ledger.type,
          rangeLabel: formatAnalysisRangeLabel(request.mode, request.anchor, result.range.label),
          activeChart: chartType,
          chartTitle: meta.title,
          chartSubtitle: meta.subtitle,
          hasRecords: request.mode === "calendar" || Number(result.overview.recordCount || 0) > 0,
          hasChartData: hasChartData(result, chartType),
          activeRanking: decorateRanking(
            chartType === "category"
              ? result.categories
              : chartType === "income"
                ? result.incomeCategories
                : getRanking({ data: result }, chartType)
          ),
          incomeCompareText: comparisonText(result.comparison, "income"),
          expenseCompareText: comparisonText(result.comparison, "expense"),
          balanceCompareText: comparisonText(result.comparison, "balance"),
          balanceComparisonText: comparisonText(result.comparison, "balance")
            ? `· ${comparisonLabel(request.mode, request.anchor)} ${comparisonText(result.comparison, "balance")}`
            : "",
          comparisonLabel: comparisonLabel(request.mode, request.anchor),
          activeDetailRows,
          hasDetailRows: activeDetailRows.length > 0,
          hasInsights:
            Object.values(result.insightGroups || {}).some((items) => items.length) ||
            result.insights.length > 0,
          monthlyTopRecords: decorateTopExpenseRecords(result.topExpenseRecords || []),
          yearRankingRows:
            this.data.yearRankingType === "income" ? result.incomeCategories : result.categories,
        };
        this.setData(nextData, () => this.renderChart());
      } catch (error) {
        if (!this.isAttached || requestId !== this.analysisRequestId) return;
        console.warn("analysis load failed", error);
        this.setData({ loading: false, error: true });
      }
    },

    async switchLedger() {
      if (this.data.isLoadingLedgers) return;
      this.setData({
        isLedgerSwitcherVisible: true,
        isLoadingLedgers: true,
        ledgerLoadError: false,
      });
      try {
        this.setData({ ledgerOptions: await ledgerStore.getLedgers() });
      } catch (_error) {
        this.setData({ ledgerLoadError: true });
      } finally {
        this.setData({ isLoadingLedgers: false });
      }
    },

    closeLedgerSwitcher() {
      this.setData({ isLedgerSwitcherVisible: false });
    },

    chooseViewLedger(event) {
      const id = event.detail.ledgerId;
      const ledger = this.data.ledgerOptions.find((item) => (item._id || item.id) === id);
      if (!ledger) return;
      this.setData({
        ledgerId: id,
        ledgerName: ledger.name,
        ledgerType: ledger.type || "personal",
        anchor: monthAnchor(),
        activeChart:
          (ledger.type || "personal") === "shared" || this.data.activeChart !== "member"
            ? this.data.activeChart
            : "trend",
        isLedgerSwitcherVisible: false,
      });
      this.loadAnalysis();
    },

    openModeSheet() {
      this.setData({ isModeSheetVisible: true });
    },

    closeModeSheet() {
      this.setData({ isModeSheetVisible: false });
    },

    openQuestionDialog(event) {
      const question = event.currentTarget.dataset.question;
      const contentByQuestion = {
        "month-chart": {
          title: "图表分析说明",
          content: "可切换查看本月每日消费走势，或各分类支出在本月消费中的占比。",
        },
        "month-top": {
          title: "本月消费 Top 5 说明",
          content: "按单笔支出金额从高到低展示本月金额最高的 5 笔消费记录。",
        },
        "year-chart": {
          title: "图表分析说明",
          content: "可切换查看全年月度收支、近年结余趋势，以及各分类支出在全年消费中的占比。",
        },
        "year-ranking": {
          title: "分类排名说明",
          content: "按分类汇总全年收入或支出并按金额排序；变化幅度用于对比上一年同期。",
        },
      };
      const dialog = contentByQuestion[question];
      if (!dialog) return;
      this.setData({
        isQuestionDialogVisible: true,
        questionDialogTitle: dialog.title,
        questionDialogContent: dialog.content,
      });
    },

    closeQuestionDialog() {
      this.setData({ isQuestionDialogVisible: false });
    },

    chooseMode(event) {
      this.closeModeSheet();
      this.setAnalysisMode(event.currentTarget.dataset.mode);
    },

    switchMode(event) {
      this.setAnalysisMode(event.currentTarget.dataset.mode);
    },

    selectMode(event) {
      const option = this.data.modeOptions[Number(event.detail.value)];
      if (option) this.setAnalysisMode(option.value);
    },

    setAnalysisMode(mode) {
      if (!this.data.modeOptions.some((item) => item.value === mode) || mode === this.data.mode)
        return;
      const customRange = customRangeDefaults();
      const nextData = {
        mode,
        activeChart: defaultChartForMode(mode),
        modeIndex: this.data.modeOptions.findIndex((item) => item.value === mode),
        modeLabel: this.data.modeOptions.find((item) => item.value === mode).label,
        anchor:
          mode === "month"
            ? monthAnchor()
            : mode === "year"
              ? String(new Date().getFullYear())
              : mode === "calendar"
                ? monthAnchor()
                : "",
      };
      if (mode === "custom") {
        nextData.customStart = this.data.customStart || customRange.start;
        nextData.customEnd = this.data.customEnd || customRange.end;
      }
      this.setData(nextData);
      this.loadAnalysis();
    },

    changeCustomStart(event) {
      const customStart = event.detail.value;
      const customEnd = customStart > this.data.customEnd ? customStart : this.data.customEnd;
      this.setData({ customStart, customEnd });
      this.loadAnalysis();
    },

    changeCustomEnd(event) {
      const customEnd = event.detail.value;
      const customStart = customEnd < this.data.customStart ? customEnd : this.data.customStart;
      this.setData({ customStart, customEnd });
      this.loadAnalysis();
    },

    shift(event) {
      const delta = Number(event.currentTarget.dataset.delta);
      if (this.data.mode === "month") {
        const date = new Date(`${this.data.anchor}-01T00:00:00`);
        date.setMonth(date.getMonth() + delta);
        this.setData({
          anchor: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        });
      } else if (this.data.mode === "year") {
        this.setData({ anchor: String(Number(this.data.anchor) + delta) });
      } else if (this.data.mode === "calendar") {
        this.setData({ anchor: shiftMonth(this.data.anchor, delta), selectedCalendarDate: "" });
      }
      this.loadAnalysis();
    },

    switchYearRanking(event) {
      const type = event.currentTarget.dataset.type;
      if (!["expense", "income"].includes(type) || type === this.data.yearRankingType) return;
      this.setData({
        yearRankingType: type,
        yearRankingRows: type === "income" ? this.data.incomeCategories : this.data.categories,
      });
    },

    selectCalendarDay(event) {
      const selectedCalendarDate = event.currentTarget.dataset.date;
      if (!selectedCalendarDate) return;
      const selectedRecords = this.data.calendarRecordsByDate[selectedCalendarDate] || [];
      const selectedSummary = summarizeCalendarRecords(selectedRecords);
      this.setData({
        selectedCalendarDate,
        selectedCalendarDateLabel: formatCalendarDateLabel(selectedCalendarDate),
        selectedCalendarRecords: selectedRecords,
        selectedCalendarSummary: {
          incomeText: formatDisplayMoney(selectedSummary.income),
          expenseText: formatDisplayMoney(selectedSummary.expense),
          count: selectedSummary.count,
        },
        calendarCells: this.data.calendarCells.map((item) => ({
          ...item,
          isActive: item.date === selectedCalendarDate,
        })),
      });
    },

    switchChart(event) {
      const activeChart = event.currentTarget.dataset.chart;
      if (!CHART_META[activeChart] || activeChart === this.data.activeChart) return;
      const meta = CHART_META[activeChart];
      const nextData = { ...this.data, activeChart };
      const detailRows = getDetailRows(nextData, activeChart);
      const ranking =
        activeChart === "category"
          ? nextData.categories
          : activeChart === "income"
            ? nextData.incomeCategories
            : getRanking({ data: nextData }, activeChart);
      this.setData(
        {
          activeChart,
          chartTitle: meta.title,
          chartSubtitle: meta.subtitle,
          hasChartData: hasChartData(nextData, activeChart),
          activeRanking: decorateRanking(ranking),
          activeDetailRows: detailRows,
          hasDetailRows: detailRows.length > 0,
        },
        () => this.renderChart()
      );
    },

    renderChart() {
      if (!this.data.hasChartData || !this.isAttached) {
        this.disposeChart();
        return;
      }
      if (this.chart) {
        this.chart.setOption(getChartOption(this), true);
      }
    },

    onChartInit(event) {
      const detail = event.detail || {};
      const canvas = detail.canvas;
      const width = Number(detail.width || 0);
      const height = Number(detail.height || 0);
      if (
        !this.isAttached ||
        this.data.loading ||
        !this.data.hasChartData ||
        !canvas ||
        !width ||
        !height
      )
        return;
      this.disposeChart();
      const chart = echarts.init(canvas, null, {
        width,
        height,
        devicePixelRatio: Math.min(Number(detail.dpr || detail.canvasDpr || 1), 2),
      });
      canvas.setChart(chart);
      chart.setOption(getChartOption(this), true);
      this.chart = chart;
      const component = this.selectComponent("#analysis-chart");
      if (component && typeof component.setChart === "function") component.setChart(chart);
    },

    onShowcaseChartInit(event) {
      const detail = event.detail || {};
      const key = event.currentTarget.dataset.chartKey;
      const canvas = detail.canvas;
      const width = Number(detail.width || 0);
      const height = Number(detail.height || 0);
      if (!this.isAttached || this.data.loading || !key || !canvas || !width || !height) return;
      this.showcaseCharts = this.showcaseCharts || {};
      if (this.showcaseCharts[key]) this.showcaseCharts[key].dispose();
      const chart = echarts.init(canvas, null, {
        width,
        height,
        devicePixelRatio: Math.min(Number(detail.dpr || detail.canvasDpr || 1), 2),
      });
      canvas.setChart(chart);
      chart.setOption(getAnalysisShowcaseChartOption(this, key), true);
      this.showcaseCharts[key] = chart;
    },

    disposeShowcaseCharts() {
      Object.values(this.showcaseCharts || {}).forEach((chart) => chart.dispose());
      this.showcaseCharts = {};
    },
    onChartInitError() {
      if (!this.isAttached || this.data.loading || !this.data.hasChartData) return;
      console.warn("analysis chart initialization failed");
      this.setData({ hasChartData: false }, () => {
        if (!this.isAttached) return;
        this.setData({ hasChartData: true });
      });
    },

    disposeChart() {
      if (this.chart) this.chart.dispose();
      this.chart = null;
      if (this.isAttached) {
        const component = this.selectComponent("#analysis-chart");
        if (component && typeof component.setChart === "function") component.setChart(null);
      }
    },

    reload() {
      this.loadAnalysis();
    },
  },
});
