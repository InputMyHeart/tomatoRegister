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
};
const CHART_COLORS = ["#f0442f", "#ff8e67", "#f5b04e", "#25a66a", "#6f9ceb", "#9b7de5"];

function monthAnchor() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function decorate(data = {}) {
  const overview = data.overview || {};
  const budget = data.budget || {};
  const categoryChart = data.categoryChart || data.categories || [];
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
      formatter: (params) => `${params.name}\n${formatTooltipAmount(params.value)} · ${params.percent}%`,
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

function getChartOption(page) {
  const chartType = page.data.activeChart;
  if (["category", "income"].includes(chartType)) return getPieOption(page, chartType);
  if (["account", "member"].includes(chartType)) return getBarOption(page, chartType);
  return getTrendOption(page);
}

function hasChartData(data, activeChart) {
  if (activeChart === "trend")
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
    anchor: "",
    rangeLabel: "",
    activeChart: "trend",
    chartTitle: CHART_META.trend.title,
    chartSubtitle: CHART_META.trend.subtitle,
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
    insights: [],
  },

  lifetimes: {
    attached() {
      this.isAttached = true;
      this.chart = null;
      this.analysisRequestId = 0;
      this.bootstrap();
    },
    detached() {
      this.isAttached = false;
      this.analysisRequestId += 1;
      this.disposeChart();
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
      };
      this.disposeChart();
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
        const nextData = {
          ...result,
          loading: false,
          ledgerName: result.ledger.name,
          ledgerType: result.ledger.type,
          rangeLabel: result.range.label,
          activeChart: chartType,
          chartTitle: meta.title,
          chartSubtitle: meta.subtitle,
          hasRecords: Number(result.overview.recordCount || 0) > 0,
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
          comparisonLabel: comparisonLabel(request.mode, request.anchor),
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

    switchMode(event) {
      const mode = event.currentTarget.dataset.mode;
      if (mode === this.data.mode) return;
      const anchor =
        mode === "month" ? monthAnchor() : mode === "year" ? String(new Date().getFullYear()) : "";
      this.setData({ mode, anchor });
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
      }
      this.loadAnalysis();
    },

    switchChart(event) {
      const activeChart = event.currentTarget.dataset.chart;
      if (!CHART_META[activeChart] || activeChart === this.data.activeChart) return;
      const meta = CHART_META[activeChart];
      const nextData = { ...this.data, activeChart };
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
