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

function dateAnchor() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
      incomeText: item.income ? formatDisplayMoney(item.income) : "",
      expenseText: item.expense ? formatDisplayMoney(item.expense) : "",
      hasIncome: Number(item.income || 0) > 0,
      hasExpense: Number(item.expense || 0) > 0,
      hasRecords: Number(item.recordCount || 0) > 0,
      isActive: date === selected,
      isToday: date === dateAnchor(),
    });
  }
  return {
    calendarAnchor: anchor,
    selectedCalendarDate: selected,
    calendarCells: cells,
    calendarRecordsByDate: recordsByDate,
    selectedCalendarRecords: recordsByDate[selected] || [],
    selectedCalendarDateLabel: selected,
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
    modeOptions: [
      { value: "month", label: "\u6708\u5ea6" },
      { value: "year", label: "\u5e74\u5ea6" },
      { value: "calendar", label: "\u65e5\u5386" },
      { value: "custom", label: "\u81ea\u5b9a\u4e49" },
      { value: "all", label: "\u5168\u90e8" },
    ],
    modeIndex: 0,
    modeLabel: "\u6708\u5ea6",
    isModeSheetVisible: false,
    anchor: "",
    customStart: "",
    customEnd: "",
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
          rangeLabel: result.range.label,
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
          comparisonLabel: comparisonLabel(request.mode, request.anchor),
          activeDetailRows,
          hasDetailRows: activeDetailRows.length > 0,
          hasInsights:
            Object.values(result.insightGroups || {}).some((items) => items.length) ||
            result.insights.length > 0,
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
        activeChart: mode === "month" ? "trend" : this.data.activeChart,
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

    selectCalendarDay(event) {
      const selectedCalendarDate = event.currentTarget.dataset.date;
      if (!selectedCalendarDate) return;
      this.setData({
        selectedCalendarDate,
        selectedCalendarDateLabel: selectedCalendarDate,
        selectedCalendarRecords: this.data.calendarRecordsByDate[selectedCalendarDate] || [],
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
