const app = getApp();
const { formatDisplayMoney } = require("../../utils/money");
const { formatDateLabel } = require("../../utils/date");
const { getId } = require("../../utils/mapper");
const ledgerService = require("../../services/ledger.service");
const ledgerStore = require("../../services/ledger.store");
const recordService = require("../../services/record.service");
const { resolveAvatarUrls } = require("../../utils/avatar");

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

function getRange(year, month) {
  const next = addMonth(year, month, 1);
  return {
    year,
    month,
    start: makeDateText(year, month, 1),
    end: makeDateText(next.year, next.month, 1),
    label: `${year}年${month}月`,
  };
}

function getCurrentRange() {
  const now = new Date();
  return getRange(now.getFullYear(), now.getMonth() + 1);
}

function normalizeRecord(record = {}) {
  const type = record.type === "income" ? "income" : "expense";
  const note = String(record.note || "").trim();
  return {
    ...record,
    id: getId(record),
    type,
    amountText: formatDisplayMoney(record.amount),
    sign: type === "income" ? "+" : "-",
    categoryText: record.categoryName || record.categoryLabel || "其他",
    noteText: note,
    hasNote: Boolean(note),
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
    isLoadingLedgers: false,
    ledgerLoadError: false,
    ...buildView([], "all"),
  },

  onLoad(options = {}) {
    this.initialMonth = /^\d{4}-\d{2}$/.test(options.month || "") ? options.month : "";
  },
  onShow() {
    if (!this.hasBootstrapped) {
      this.hasBootstrapped = true;
      this.bootstrap();
      return;
    }

    if (app.globalData.recordsNeedRefresh) {
      app.globalData.recordsNeedRefresh = false;
      this.bootstrap();
    }
  },

  async bootstrap() {
    if (!app.globalData.loggedIn) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }

    await app.loginWithWechat();
    const ledger = app.globalData.currentLedger || {};
    const currentRange = this.initialMonth
      ? getRange(Number(this.initialMonth.slice(0, 4)), Number(this.initialMonth.slice(5, 7)))
      : getCurrentRange();
    this.initialMonth = "";
    this.setData({
      ledgerId: ledger._id || "",
      ledgerName: ledger.name || "我的账本",
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
      const page = (await resolveAvatarUrls(data.records || [], "memberAvatar")).map(
        normalizeRecord
      );
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

  chooseViewLedger(event) {
    const ledgerId = event.detail.ledgerId;
    const ledger = this.data.ledgerOptions.find((item) => (item._id || item.id) === ledgerId);
    if (!ledger || ledgerId === this.data.ledgerId) {
      this.closeLedgerSwitcher();
      return;
    }
    const currentRange = this.initialMonth
      ? getRange(Number(this.initialMonth.slice(0, 4)), Number(this.initialMonth.slice(5, 7)))
      : getCurrentRange();
    this.initialMonth = "";
    this.setData({
      ledgerId,
      ledgerName: ledger.name || "我的账本",
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
    const nextRange = getRange(previous.year, previous.month);
    this.setData({ currentRange: nextRange, monthLabel: nextRange.label });
    this.loadRecords(nextRange);
  },

  nextMonth() {
    const range = this.data.currentRange;
    const next = addMonth(range.year, range.month, 1);
    const nextRange = getRange(next.year, next.month);
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
