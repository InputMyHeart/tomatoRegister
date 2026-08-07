import * as echarts from "../ec-canvas/echarts";

const app = getApp();
const ledgerService = require("../../services/ledger.service");
const ledgerStore = require("../../services/ledger.store");
const { formatDisplayMoney } = require("../../utils/money");
function monthAnchor() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function decorate(data = {}) {
  const max = Math.max(1, ...(data.trend || []).map((x) => Math.max(x.income, x.expense)));
  return {
    ...data,
    overview: {
      ...(data.overview || {}),
      incomeText: formatDisplayMoney(data.overview && data.overview.income),
      expenseText: formatDisplayMoney(data.overview && data.overview.expense),
      balanceText: formatDisplayMoney(data.overview && data.overview.balance),
      budgetText: formatDisplayMoney(data.overview && data.overview.budget),
      budgetLeftText: formatDisplayMoney(data.overview && data.overview.budgetLeft),
    },
    trend: (data.trend || []).map((x) => ({
      ...x,
      incomeText: formatDisplayMoney(x.income),
      expenseText: formatDisplayMoney(x.expense),
      incomeRate: Math.max(2, Math.round((x.income * 100) / max)),
      expenseRate: Math.max(2, Math.round((x.expense * 100) / max)),
    })),
    categories: (data.categories || []).map((x) => ({
      ...x,
      amountText: formatDisplayMoney(x.amount),
    })),
    members: (data.members || []).map((x) => ({
      ...x,
      initial: String(x.name || "?").slice(0, 1),
      amountText: formatDisplayMoney(x.amount),
    })),
  };
}
let analysisPage = null;

function amount(value) {
  return Number(value || 0);
}

function getChartOption() {
  const page = analysisPage;
  if (!page) return {};
  if (page.data.activeChart === "category") {
    return {
      color: ["#f0442f", "#ff8e67", "#f5b04e", "#25a66a", "#6f9ceb", "#9b7de5"],
      tooltip: { trigger: "item", confine: true },
      legend: { type: "scroll", bottom: 0, textStyle: { color: "#8f766d", fontSize: 10 } },
      series: [
        {
          type: "pie",
          radius: ["45%", "72%"],
          center: ["50%", "44%"],
          itemStyle: { borderColor: "#fffaf7", borderWidth: 4 },
          label: { color: "#6e5a52", fontSize: 10, formatter: "{b}\\n{d}%" },
          data: (page.data.categories || []).map((item) => ({
            name: item.name,
            value: amount(item.amount),
          })),
        },
      ],
    };
  }
  if (page.data.activeChart === "member") {
    return {
      color: ["#f0442f"],
      tooltip: { trigger: "axis", confine: true },
      grid: { top: 14, right: 26, bottom: 16, left: 18 },
      xAxis: { type: "value", splitLine: { lineStyle: { color: "#f4e9e4", type: "dashed" } } },
      yAxis: {
        type: "category",
        inverse: true,
        data: (page.data.members || []).map((item) => item.name),
      },
      series: [
        {
          type: "bar",
          barWidth: 14,
          itemStyle: { borderRadius: [0, 8, 8, 0] },
          data: (page.data.members || []).map((item) => amount(item.amount)),
        },
      ],
    };
  }
  return {
    color: ["#25a66a", "#f0442f"],
    tooltip: { trigger: "axis", confine: true },
    legend: { bottom: 0, data: ["收入", "支出"], textStyle: { color: "#8f766d", fontSize: 11 } },
    grid: { top: 24, right: 14, bottom: 48, left: 14 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: (page.data.trend || []).map((item) => item.label),
    },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#f4e9e4", type: "dashed" } } },
    series: [
      {
        name: "收入",
        type: "line",
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 3 },
        areaStyle: { color: "rgba(37, 166, 106, 0.10)" },
        data: (page.data.trend || []).map((item) => amount(item.income)),
      },
      {
        name: "支出",
        type: "line",
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 3 },
        areaStyle: { color: "rgba(240, 68, 47, 0.10)" },
        data: (page.data.trend || []).map((item) => amount(item.expense)),
      },
    ],
  };
}

function hasActiveChartData(data, activeChart) {
  if (activeChart === "category") return Boolean((data.categories || []).length);
  if (activeChart === "member") return Boolean((data.members || []).length);
  return Boolean((data.trend || []).length);
}

function initChart(canvas, width, height, devicePixelRatio) {
  const chart = echarts.init(canvas, null, { width, height, devicePixelRatio });
  canvas.setChart(chart);
  if (analysisPage) analysisPage.chart = chart;
  chart.setOption(getChartOption(), true);
  return chart;
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
    hasChartData: false,
    ec: { onInit: initChart, disableTouch: true },
    loading: true,
    error: false,
    isLedgerSwitcherVisible: false,
    isLoadingLedgers: false,
    ledgerLoadError: false,
    overview: {},
    trend: [],
    categories: [],
    members: [],
    insights: [],
  },
  lifetimes: {
    attached() {
      analysisPage = this;
      this.chart = null;
      this.bootstrap();
    },
    detached() {
      this.disposeChart();
      if (analysisPage === this) analysisPage = null;
    },
  },

  methods: {
    async bootstrap() {
      if (!app.globalData.loggedIn) return wx.reLaunch({ url: "/pages/login/index" });
      await app.loginWithWechat();
      const ledger = app.globalData.currentLedger || {};
      this.setData({
        ledgerId: ledger._id || "",
        ledgerName: ledger.name || "分析账本",
        ledgerType: ledger.type || "personal",
        anchor: monthAnchor(),
      });
      this.loadAnalysis();
    },
    async loadAnalysis() {
      if (!this.data.ledgerId) return this.setData({ loading: false });
      this.disposeChart();
      this.setData({ loading: true, error: false });
      try {
        const result = decorate(
          await ledgerService.getAnalysis({
            ledgerId: this.data.ledgerId,
            mode: this.data.mode,
            anchor: this.data.anchor,
          })
        );
        this.setData({
          loading: false,
          ledgerName: result.ledger.name,
          ledgerType: result.ledger.type,
          rangeLabel: result.range.label,
          overview: result.overview,
          trend: result.trend,
          categories: result.categories,
          members: result.members,
          insights: result.insights || [],
          hasChartData: hasActiveChartData(result, this.data.activeChart),
        });
      } catch (_error) {
        console.warn("analysis load failed", _error);
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
        const data = { ledgers: await ledgerStore.getLedgers() };
        this.setData({ ledgerOptions: data.ledgers || [] });
      } catch (_error) {
        this.setData({ ledgerLoadError: true });
      } finally {
        this.setData({ isLoadingLedgers: false });
      }
    },
    closeLedgerSwitcher() {
      this.setData({ isLedgerSwitcherVisible: false });
    },
    stopLedgerSwitcherTap() {},
    chooseViewLedger(e) {
      const id = e.detail.ledgerId,
        ledger = this.data.ledgerOptions.find((x) => (x._id || x.id) === id);
      if (!ledger) return;
      this.setData({
        ledgerId: id,
        ledgerName: ledger.name,
        ledgerType: ledger.type || "personal",
        anchor: monthAnchor(),
        activeChart: (ledger.type || "personal") === "shared" ? this.data.activeChart : "trend",
        isLedgerSwitcherVisible: false,
      });
      this.loadAnalysis();
    },
    switchMode(e) {
      const mode = e.currentTarget.dataset.mode;
      if (mode === this.data.mode) return;
      const anchor =
        mode === "month" ? monthAnchor(1) : mode === "year" ? String(new Date().getFullYear()) : "";
      this.setData({ mode, anchor });
      this.loadAnalysis();
    },
    shift(e) {
      const delta = Number(e.currentTarget.dataset.delta);
      if (this.data.mode === "month") {
        const d = new Date(`${this.data.anchor}-01T00:00:00`);
        d.setMonth(d.getMonth() + delta);
        this.setData({ anchor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` });
      } else if (this.data.mode === "year")
        this.setData({ anchor: String(Number(this.data.anchor) + delta) });
      this.loadAnalysis();
    },
    switchChart(e) {
      const activeChart = e.currentTarget.dataset.chart;
      this.setData(
        {
          activeChart,
          hasChartData: hasActiveChartData(this.data, activeChart),
        },
        () => this.updateChart()
      );
    },
    disposeChart() {
      if (this.chart) this.chart.dispose();
      this.chart = null;
    },
    updateChart() {
      if (!this.data.hasChartData) {
        this.disposeChart();
        return;
      }
      if (this.chart) this.chart.setOption(getChartOption(), true);
    },
    reload() {
      this.loadAnalysis();
    },
  },
});
