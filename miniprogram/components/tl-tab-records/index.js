const feedback = require("../../services/feedback-ui");
const app = getApp();
const { formatDisplayMoney } = require("../../utils/money");
const { formatDateLabel } = require("../../utils/date");
const { getId } = require("../../utils/mapper");
const ledgerStore = require("../../services/ledger.store");
const recordService = require("../../services/record.service");
const { resolveAvatarUrls } = require("../../utils/avatar");
const { on: onEvent, off: offEvent } = require("../../utils/event-bus");

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
    categoryIcon: record.categoryIcon || (type === "income" ? "funds-line" : "price-tag-3-line"),
    amountText: formatDisplayMoney(record.amount),
    sign: type === "income" ? "+" : "-",
    categoryText: record.categoryName || record.categoryLabel || "其他",
    noteText: note,
    hasNote: Boolean(note),
    dateLabel: formatDateLabel(record.date),
    timeText: record.date || "未选择日期",
    memberName: record.memberName || "我",
    memberAvatar: record.memberAvatar || "/images/brand/tomato-ledger-logo-256-transparent.png",
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

  return {
    recordGroups: groups.map((group) => ({
      ...group,
      income: formatDisplayMoney(group.income),
      expense: formatDisplayMoney(group.expense),
    })),
    hasRecords: visibleRecords.length > 0,
  };
}

Component({
  properties: {
    initialMonth: {
      type: String,
      value: "",
    },
  },
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
    historyRecordCount: 0,
    rangeRecordCount: 0,
    monthIncome: "0",
    monthExpense: "0",
    monthRecordCount: 0,
    latestRecordDate: "",
    latestRecordMonthLabel: "",
    isError: false,
    records: [],
    currentRange: null,
    ledgerOptions: [],
    isLedgerSwitcherVisible: false,
    isLoadingLedgers: false,
    ledgerLoadError: false,
    ...buildView([], "all"),
  },

  lifetimes: {
    attached() {
      this.isAttached = true;
      this.recordsRequestId = 0;
      this.initialMonth = this.properties.initialMonth || "";
      this.bootstrap();
      this._onRecordsChanged = (result = {}) => {
        if (!result.ledgerId || result.ledgerId === this.data.ledgerId) this.refreshRecords();
      };
      onEvent("records:changed", this._onRecordsChanged);
    },
    detached() {
      this.isAttached = false;
      this.recordsRequestId += 1;
      if (this._onRecordsChanged) {
        offEvent("records:changed", this._onRecordsChanged);
        this._onRecordsChanged = null;
      }
    },
  },

  methods: {
    refreshRecords(syncResult = {}) {
      const removed = syncResult.removedLedgerIds || [];
      if (removed.includes(this.data.ledgerId)) return this.bootstrap();
      const changed = syncResult.changedLedgerIds || [];
      if (changed.length && !changed.includes(this.data.ledgerId)) return;
      return this.loadRecords(this.data.currentRange);
    },

    async bootstrap() {
      if (!app.globalData.loggedIn) {
        wx.reLaunch({ url: "/pages/login/index" });
        return;
      }

      try {
        await app.loginWithWechat();
      } catch (_error) {
        if (this.isAttached) this.setData({ loading: false, isError: true });
        return;
      }
      if (!this.isAttached) return;
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
      if (!range || (append && (this.data.loading || !this.data.hasMore || this.data.loadingMore)))
        return;
      const requestId = ++this.recordsRequestId;
      const ledgerId = this.data.ledgerId;
      if (!ledgerId) {
        this.setData({
          loading: false,
          loadingMore: false,
          isError: false,
          records: [],
          hasMore: false,
          nextCursor: null,
          monthIncome: "0",
          monthExpense: "0",
          monthRecordCount: 0,
          historyRecordCount: 0,
          rangeRecordCount: 0,
          latestRecordDate: "",
          latestRecordMonthLabel: "",
          ...buildView([], this.data.activeType),
        });
        return;
      }
      if (!append) {
        this.setData({
          loading: true,
          loadingMore: false,
          isError: false,
          records: [],
          hasMore: false,
          nextCursor: null,
          ...buildView([], this.data.activeType),
        });
      } else {
        this.setData({ loadingMore: true });
      }

      try {
        const data = await recordService.listRecords({
          ledgerId,
          start: range.start,
          end: range.end,
          pageSize: 30,
          cursor: append ? this.data.nextCursor : null,
        });
        const page = (await resolveAvatarUrls(data.records || [], "memberAvatar")).map(
          normalizeRecord
        );
        if (!this.isAttached || requestId !== this.recordsRequestId) return;
        const records = append ? [...this.data.records, ...page] : page;
        const latestRecordDate = data.latestRecordDate || "";
        const latestRecordMonthLabel = /^\d{4}-\d{2}-\d{2}$/.test(latestRecordDate)
          ? getRange(Number(latestRecordDate.slice(0, 4)), Number(latestRecordDate.slice(5, 7)))
              .label
          : "";
        this.setData({
          loading: false,
          loadingMore: false,
          records,
          nextCursor: data.nextCursor || null,
          hasMore: Boolean(data.hasMore),
          historyRecordCount: Number(data.historyRecordCount || 0),
          rangeRecordCount: Number(data.rangeRecordCount || 0),
          monthIncome: formatDisplayMoney((data.rangeSummary || {}).income),
          monthExpense: formatDisplayMoney((data.rangeSummary || {}).expense),
          monthRecordCount: Number(data.rangeRecordCount || 0),
          latestRecordDate,
          latestRecordMonthLabel,
          readonly: Boolean(data.readonly),
          ledgerName: (data.ledger && data.ledger.name) || this.data.ledgerName,
          ...buildView(records, this.data.activeType),
        });
      } catch (error) {
        if (!this.isAttached || requestId !== this.recordsRequestId) return;
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

    goRecordEdit() {
      if (this.data.readonly) {
        feedback.showReadonlyToast();
        return;
      }
      wx.navigateTo({
        url: `/pages/record-category/index?ledgerId=${encodeURIComponent(this.data.ledgerId)}`,
      });
    },
    goLatestRecordMonth() {
      const date = this.data.latestRecordDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const range = getRange(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
      this.setData({ currentRange: range, monthLabel: range.label, activeType: "all" });
      this.loadRecords(range);
    },
    openRecord(event) {
      const id = event.currentTarget.dataset.id;
      if (!id) return;
      const page = this.data.readonly ? "record-detail" : "record-edit";
      wx.navigateTo({ url: `/pages/${page}/index?id=${encodeURIComponent(id)}` });
    },

    reload() {
      if (!this.data.currentRange) return this.bootstrap();
      return this.loadRecords();
    },
  },
});
