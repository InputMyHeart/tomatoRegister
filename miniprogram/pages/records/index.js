const app = getApp();
const { formatDisplayMoney } = require("../../utils/money");
const { formatDateLabel } = require("../../utils/date");
const { getId } = require("../../utils/mapper");
const ledgerService = require("../../services/ledger.service");
const recordService = require("../../services/record.service");

const weekdayMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function makeDateText(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addMonth(year, month, delta) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function getRange(year, month, monthStartDay) {
  const startDay = Math.min(28, Math.max(1, Number(monthStartDay || 1)));
  const next = addMonth(year, month, 1);
  return {
    year,
    month,
    start: makeDateText(year, month, startDay),
    end: makeDateText(next.year, next.month, startDay),
    label: `${year}年${month}月`,
  };
}

function getCurrentRange(monthStartDay) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (now.getDate() < Number(monthStartDay || 1)) {
    const previous = addMonth(year, month, -1);
    year = previous.year;
    month = previous.month;
  }
  return getRange(year, month, monthStartDay);
}

function normalizeRecord(record = {}) {
  const type = record.type === "income" ? "income" : "expense";
  return {
    ...record,
    id: getId(record),
    type,
    amountText: formatDisplayMoney(record.amount),
    sign: type === "income" ? "+" : "-",
    categoryText: record.categoryName || record.categoryLabel || "其他",
    noteText: record.note || "未填写备注",
    dateLabel: formatDateLabel(record.date),
    timeText: record.date || "未选择日期",
    memberName: record.memberName || "我",
    memberAvatar: record.memberAvatar || "/images/brand/tomato-ledger-logo-256-transparent.png",
    accountText: record.account || "未选择账户",
  };
}

function buildView(records, activeType) {
  const visibleRecords =
    activeType === "all" ? records : records.filter((item) => item.type === activeType);
  const groups = [];
  const groupMap = {};

  visibleRecords.forEach((record) => {
    if (!groupMap[record.date]) {
      const date = new Date(`${record.date}T00:00:00`);
      groupMap[record.date] = {
        date: record.date,
        dateLabel: record.dateLabel,
        weekday: Number.isNaN(date.getTime()) ? "" : weekdayMap[date.getDay()],
        income: 0,
        expense: 0,
        records: [],
      };
      groups.push(groupMap[record.date]);
    }
    const group = groupMap[record.date];
    if (record.type === "income") group.income += Number(record.amount || 0);
    if (record.type === "expense") group.expense += Number(record.amount || 0);
    group.records.push(record);
  });

  const visibleIncome = visibleRecords
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const visibleExpense = visibleRecords
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    recordGroups: groups.map((group) => ({
      ...group,
      income: formatDisplayMoney(group.income),
      expense: formatDisplayMoney(group.expense),
    })),
    visibleIncome: formatDisplayMoney(visibleIncome),
    visibleExpense: formatDisplayMoney(visibleExpense),
    visibleCount: visibleRecords.length,
    hasRecords: visibleRecords.length > 0,
  };
}

Page({
  data: {
    ledgerName: "我的账本",
    ledgerId: "",
    monthLabel: "",
    monthStartDay: 1,
    activeType: "all",
    readonly: false,
    loading: true,
    loadingMore: false,
    hasMore: false,
    nextCursor: null,
    isError: false,
    records: [],
    currentRange: null,
    ledgerOptions: [],
    isLedgerSwitcherVisible: false,
    ...buildView([], "all"),
  },

  onShow() {
    this.bootstrap();
  },

  async bootstrap() {
    if (!app.globalData.loggedIn) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }

    await app.loginWithWechat();
    const ledger = app.globalData.currentLedger || {};
    const monthStartDay = Number(ledger.monthStartDay || 1);
    const currentRange = this.data.currentRange || getCurrentRange(monthStartDay);
    this.setData({
      ledgerId: ledger._id || "",
      ledgerName: ledger.name || "我的账本",
      monthStartDay,
      readonly: Boolean(ledger.readonly),
      currentRange,
      monthLabel: currentRange.label,
    });
    await this.loadRecords(currentRange);
  },

  async loadRecords(range = this.data.currentRange, append = false) {
    if (!range || (append && (!this.data.hasMore || this.data.loadingMore))) return;
    this.setData(
      append
        ? { loadingMore: true }
        : { loading: true, isError: false, records: [], nextCursor: null, hasMore: false }
    );
    try {
      const data = await recordService.listRecords({
        ledgerId: this.data.ledgerId,
        start: range.start,
        end: range.end,
        pageSize: 30,
        cursor: append ? this.data.nextCursor : null,
      });
      const page = (data.records || []).map(normalizeRecord);
      const records = append ? [...this.data.records, ...page] : page;
      this.setData({
        loading: false,
        loadingMore: false,
        records,
        nextCursor: data.nextCursor || null,
        hasMore: Boolean(data.hasMore),
        readonly: Boolean(data.readonly),
        ...buildView(records, this.data.activeType),
      });
    } catch (error) {
      console.warn("load records failed", error);
      this.setData(
        append
          ? { loadingMore: false }
          : { loading: false, isError: true, ...buildView([], this.data.activeType) }
      );
    }
  },

  loadMore() {
    this.loadRecords(this.data.currentRange, true);
  },

  switchType(event) {
    const activeType = event.currentTarget.dataset.type;
    this.setData({ activeType, ...buildView(this.data.records, activeType) });
  },

  async switchLedger() {
    try {
      const data = await ledgerService.listLedgers();
      const ledgerOptions = data.ledgers || [];
      this.setData({ ledgerOptions, isLedgerSwitcherVisible: true });
    } catch (_error) {
      wx.showToast({ title: "账本加载失败", icon: "none" });
    }
  },

  closeLedgerSwitcher() {
    this.setData({ isLedgerSwitcherVisible: false });
  },
  stopLedgerSwitcherTap() {},

  chooseViewLedger(event) {
    const ledgerId = event.currentTarget.dataset.id;
    const ledger = this.data.ledgerOptions.find((item) => (item._id || item.id) === ledgerId);
    if (!ledger || ledgerId === this.data.ledgerId) {
      this.closeLedgerSwitcher();
      return;
    }
    const monthStartDay = Number(ledger.monthStartDay || 1);
    const currentRange = getCurrentRange(monthStartDay);
    this.setData({
      ledgerId,
      ledgerName: ledger.name || "我的账本",
      monthStartDay,
      currentRange,
      monthLabel: currentRange.label,
      isLedgerSwitcherVisible: false,
      activeType: "all",
    });
    this.loadRecords(currentRange);
  },

  prevMonth() {
    const range = this.data.currentRange;
    const previous = addMonth(range.year, range.month, -1);
    const nextRange = getRange(previous.year, previous.month, this.data.monthStartDay);
    this.setData({ currentRange: nextRange, monthLabel: nextRange.label });
    this.loadRecords(nextRange);
  },

  nextMonth() {
    const range = this.data.currentRange;
    const next = addMonth(range.year, range.month, 1);
    const nextRange = getRange(next.year, next.month, this.data.monthStartDay);
    this.setData({ currentRange: nextRange, monthLabel: nextRange.label });
    this.loadRecords(nextRange);
  },

  openRecord(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/record-edit/index?id=${encodeURIComponent(id)}` });
  },

  reload() {
    this.loadRecords();
  },
});
