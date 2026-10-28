const { amount, money, getRanking } = require("./view-model");

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

const CHART_THEME = {
  expense: "#f0442f",
  income: "#25a66a",
  balance: "#6f625d",
  axisText: "#9a8278",
  axisLine: "#eadbd4",
  gridLine: "#f4e9e4",
  legendText: "#8f766d",
  labelText: "#6e5a52",
  surface: "#fffaf7",
  inverseText: "#ffffff",
  accentWarm: "#f5b04e",
  accentCool: "#6f9ceb",
};
const CHART_COLORS = [
  CHART_THEME.expense,
  "#ff8e67",
  CHART_THEME.accentWarm,
  CHART_THEME.income,
  CHART_THEME.accentCool,
  "#9b7de5",
];

const ANALYSIS_CHART_TYPES = [
  "monthTrend",
  "monthRatio",
  "yearCashflow",
  "yearBalance",
  "yearRatio",
];

function defaultChartForMode(mode) {
  if (mode === "month") return "monthTrend";
  if (mode === "year") return "yearCashflow";
  return "trend";
}

function formatTooltipAmount(value) {
  return money(Array.isArray(value) ? value[value.length - 1] : value);
}

function getPieOption(data, chartType) {
  const rows = getRanking(data, chartType);
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
        itemStyle: { borderColor: CHART_THEME.surface, borderWidth: 3 },
        label: { color: CHART_THEME.labelText, fontSize: 10, formatter: "{b}\n{d}%" },
        labelLine: { length: 10, length2: 8 },
        data: rows.map((item) => ({ name: item.name, value: amount(item.amount) })),
      },
    ],
  };
}

function getBarOption(data, chartType) {
  const rows = getRanking(data, chartType).slice(0, 8);
  return {
    color: [chartType === "income" ? CHART_THEME.income : CHART_THEME.expense],
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
      axisLabel: { color: CHART_THEME.axisText, fontSize: 9, formatter: (value) => `${value}` },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine, type: "dashed" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: CHART_THEME.balance, fontSize: 10, width: 76, overflow: "truncate" },
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

function getTrendOption(data) {
  const trend = data.trend || [];
  return {
    color: [CHART_THEME.income, CHART_THEME.expense, CHART_THEME.balance],
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
      textStyle: { color: CHART_THEME.legendText, fontSize: 10 },
    },
    grid: { top: 20, right: 12, bottom: 44, left: 8, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
      axisLabel: {
        color: CHART_THEME.axisText,
        fontSize: 9,
        interval: data.mode === "month" ? 4 : "auto",
      },
      data: trend.map((item) => item.label),
    },
    yAxis: {
      type: "value",
      axisLabel: { color: CHART_THEME.axisText, fontSize: 9 },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine, type: "dashed" } },
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

function getMonthlyExpenseTrendOption(data) {
  const trend = data.trend || [];
  const expenses = trend.map((item) => amount(item.expense));
  const expenseDays = expenses.map((value) => (value > 0 ? value : null));
  return {
    color: [CHART_THEME.expense],
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
      axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
      axisLabel: { color: CHART_THEME.axisText, fontSize: 9, interval: 4 },
      data: trend.map((item) => item.label),
    },
    yAxis: {
      type: "value",
      axisLabel: { color: CHART_THEME.axisText, fontSize: 9 },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine, type: "dashed" } },
    },
    series: [
      {
        name: "消费",
        type: "line",
        smooth: false,
        symbol: "circle",
        showSymbol: false,
        lineStyle: { width: 3 },
        itemStyle: { color: CHART_THEME.expense },
        data: expenseDays,
        markPoint: {
          symbolSize: 42,
          label: { color: CHART_THEME.inverseText, fontSize: 9, formatter: "{b}" },
          data: [
            { type: "min", name: "最低", itemStyle: { color: CHART_THEME.income } },
            { type: "max", name: "最高", itemStyle: { color: CHART_THEME.expense } },
          ],
        },
      },
    ],
  };
}

function getChartOption(data, chartType = data.activeChart) {
  if (chartType === "monthTrend") return getMonthlyExpenseTrendOption(data);
  if (chartType === "monthRatio") return getPieOption(data, "category");
  if (chartType === "yearCashflow") return getYearChartOption(data, "year-cashflow");
  if (chartType === "yearBalance") return getYearChartOption(data, "year-balance");
  if (chartType === "yearRatio") return getYearChartOption(data, "year-ratio");
  if (["category", "income"].includes(chartType)) return getPieOption(data, chartType);
  if (["account", "member"].includes(chartType)) return getBarOption(data, chartType);
  return getTrendOption(data);
}

function getYearChartOption(data, key) {
  const trend = data.trend || [];
  const base = {
    animationDuration: 350,
    grid: { top: 20, right: 14, bottom: 26, left: 10, containLabel: true },
    xAxis: {
      type: "category",
      axisTick: { show: false },
      axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
      axisLabel: { color: CHART_THEME.axisText, fontSize: 9 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: CHART_THEME.axisText, fontSize: 9 },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine, type: "dashed" } },
    },
  };
  if (key === "year-ratio") return getPieOption(data, "category");
  if (key === "year-cashflow") {
    const expenseValues = trend.map((item) => amount(item.expense)).filter((value) => value > 0);
    const maxExpense = expenseValues.length ? Math.max(...expenseValues) : null;
    const minExpense = expenseValues.length ? Math.min(...expenseValues) : null;
    const expenseData = trend.map((item) => {
      const value = amount(item.expense);
      const color =
        value > 0 && value === maxExpense
          ? CHART_THEME.accentWarm
          : value > 0 && value === minExpense
            ? CHART_THEME.accentCool
            : CHART_THEME.expense;
      return { value, itemStyle: { color, borderRadius: [6, 6, 0, 0] } };
    });
    return {
      ...base,
      color: [CHART_THEME.income, CHART_THEME.expense],
      tooltip: {
        trigger: "axis",
        triggerOn: "click",
        confine: true,
        axisPointer: { type: "shadow" },
      },
      legend: {
        top: 0,
        data: ["\u6536\u5165", "\u652f\u51fa"],
        textStyle: { color: CHART_THEME.legendText, fontSize: 10 },
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
    const recentYearTrend = data.recentYearTrend || [];
    return {
      ...base,
      color: [CHART_THEME.expense],
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
                color: value < 0 ? CHART_THEME.accentCool : CHART_THEME.expense,
                borderRadius: value < 0 ? [0, 0, 6, 6] : [6, 6, 0, 0],
              },
            };
          }),
        },
      ],
    };
  }
  return getTrendOption(data);
}

function hasChartData(data, activeChart) {
  if (activeChart === "yearBalance") {
    return (data.recentYearTrend || []).some(
      (item) => amount(item.income) !== 0 || amount(item.expense) !== 0
    );
  }
  if (activeChart === "trend" || ANALYSIS_CHART_TYPES.includes(activeChart))
    return Boolean(data.overview && Number(data.overview.recordCount || 0) > 0);
  return Boolean(getRanking(data, activeChart).length);
}

module.exports = { CHART_META, defaultChartForMode, getChartOption, hasChartData };
