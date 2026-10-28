import * as echarts from "../ec-canvas/echarts";
const app = getApp();
const ledgerService = require("../../services/ledger.service");
const ledgerStore = require("../../services/ledger.store");
const { on: onEvent, off: offEvent } = require("../../utils/event-bus");
const { logPerformance } = require("../../utils/performance");
const { formatDisplayMoney } = require("../../utils/money");
const {
  monthAnchor,
  customRangeDefaults,
  shiftMonth,
  formatCalendarDateLabel,
  formatAnalysisRangeLabel,
} = require("./dates");
const {
  comparisonText,
  comparisonLabel,
  decorateRanking,
  getDetailRows,
  summarizeCalendarRecords,
  decorateCalendar,
  decorateTopExpenseRecords,
  decorate,
  getRanking,
} = require("./view-model");
const {
  CHART_META,
  defaultChartForMode,
  getChartOption,
  hasChartData,
} = require("./chart-options");

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
    monthlyTopRecords: [],
    yearRankingType: "expense",
    yearRankingRows: [],
    isQuestionDialogVisible: false,
    questionDialogTitle: "",
    questionDialogContent: "",
  },

  lifetimes: {
    attached() {
      this.isAttached = true;
      this.chart = null;
      this.secondaryCharts = {};
      this.analysisRequestId = 0;
      this.bootstrap();
      this._onRecordsChanged = (result = {}) => {
        if (!result.ledgerId || result.ledgerId === this.data.ledgerId) this.loadAnalysis();
      };
      onEvent("records:changed", this._onRecordsChanged);
    },
    detached() {
      if (this._onRecordsChanged) offEvent("records:changed", this._onRecordsChanged);
      this.isAttached = false;
      this.analysisRequestId += 1;
      this.disposeChart();
      this.disposeSecondaryCharts();
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
      const startedAt = Date.now();
      const requestId = ++this.analysisRequestId;
      const request = {
        ledgerId: this.data.ledgerId,
        mode: this.data.mode,
        anchor: this.data.anchor,
        customStart: this.data.customStart,
        customEnd: this.data.customEnd,
      };
      this.disposeChart();
      this.disposeSecondaryCharts();
      this.setData({ loading: true, error: false, noLedger: false, hasChartData: false });
      try {
        const result = decorate(await ledgerService.getAnalysis(request));
        if (!this.isAttached || requestId !== this.analysisRequestId) return;
        if (result.noLedger || !result.ledger) {
          this.setData({ loading: false, noLedger: true }, () =>
            logPerformance("analysis", "content-ready", startedAt, "no-ledger")
          );
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
                : getRanking(result, chartType)
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
        this.setData(nextData, () => {
          logPerformance("analysis", "content-ready", startedAt);
          this.renderChart();
        });
      } catch (error) {
        if (!this.isAttached || requestId !== this.analysisRequestId) return;
        console.warn("analysis load failed", error);
        this.setData({ loading: false, error: true }, () =>
          logPerformance("analysis", "content-ready", startedAt, "error")
        );
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
        this.setData({ anchor: shiftMonth(this.data.anchor, delta) });
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
            : getRanking(nextData, activeChart);
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
        this.chart.setOption(getChartOption(this.data), true);
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
      chart.setOption(getChartOption(this.data), true);
      this.chart = chart;
      const component = this.selectComponent("#analysis-chart");
      if (component && typeof component.setChart === "function") component.setChart(chart);
    },

    onSecondaryChartInit(event) {
      const detail = event.detail || {};
      const key = event.currentTarget.dataset.chartKey;
      const canvas = detail.canvas;
      const width = Number(detail.width || 0);
      const height = Number(detail.height || 0);
      if (!this.isAttached || this.data.loading || !key || !canvas || !width || !height) return;
      this.secondaryCharts = this.secondaryCharts || {};
      if (this.secondaryCharts[key]) this.secondaryCharts[key].dispose();
      const chart = echarts.init(canvas, null, {
        width,
        height,
        devicePixelRatio: Math.min(Number(detail.dpr || detail.canvasDpr || 1), 2),
      });
      canvas.setChart(chart);
      chart.setOption(getChartOption(this.data, key), true);
      this.secondaryCharts[key] = chart;
    },

    disposeSecondaryCharts() {
      Object.values(this.secondaryCharts || {}).forEach((chart) => chart.dispose());
      this.secondaryCharts = {};
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
