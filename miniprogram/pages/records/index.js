const app = getApp();

const weekdayMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function money(value) {
  const num = Number(value || 0);
  return num.toFixed(num % 1 === 0 ? 0 : 2);
}

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

function formatDateLabel(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText || "未选择日期";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function normalizeRecord(record = {}) {
  const type = record.type === "income" ? "income" : "expense";
  return {
    ...record,
    id: record.id || record._id || "",
    type,
    amountText: money(record.amount),
    sign: type === "income" ? "+" : "-",
    categoryText: record.categoryName || record.categoryLabel || "其他",
    noteText: record.note || "未填写备注",
    dateLabel: formatDateLabel(record.date),
    timeText: record.time || record.date || "未选择时间",
    memberName: record.memberName || "我",
    memberAvatar: record.memberAvatar || "/images/brand/tomato-ledger-logo-256-transparent.png",
    accountText: record.account || "未选择账户",
  };
}

function buildView(records, activeType) {
  const visibleRecords = activeType === "all" ? records : records.filter((item) => item.type === activeType);
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

  const visibleIncome = visibleRecords.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const visibleExpense = visibleRecords.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    recordGroups: groups.map((group) => ({
      ...group,
      income: money(group.income),
      expense: money(group.expense),
    })),
    visibleIncome: money(visibleIncome),
    visibleExpense: money(visibleExpense),
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
    isError: false,
    records: [],
    currentRange: null,
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

  async callApi(action, data = {}) {
    if (!app.globalData.env) return null;
    const res = await wx.cloud.callFunction({
      name: "tomatoLedger",
      data: { action, data },
    });
    return res.result;
  },

  async loadRecords(range = this.data.currentRange) {
    if (!range) return;
    this.setData({ loading: true, isError: false });
    try {
      const result = await this.callApi("listRecords", {
        ledgerId: this.data.ledgerId,
        start: range.start,
        end: range.end,
      });
      if (!result || !result.success || !result.data) {
        throw new Error((result && result.message) || "明细加载失败");
      }

      const ledger = result.data.ledger || {};
      if (ledger._id) {
        app.globalData.currentLedger = {
          ...(app.globalData.currentLedger || {}),
          ...ledger,
        };
        app.globalData.readonly = Boolean(result.data.readonly);
        app.persistAuthState();
      }

      const records = (result.data.records || []).map(normalizeRecord);
      this.setData({
        loading: false,
        records,
        readonly: Boolean(result.data.readonly),
        ...buildView(records, this.data.activeType),
      });
    } catch (error) {
      console.warn("load records failed", error);
      this.setData({ loading: false, isError: true, ...buildView([], this.data.activeType) });
    }
  },

  switchType(event) {
    const activeType = event.currentTarget.dataset.type;
    this.setData({ activeType, ...buildView(this.data.records, activeType) });
  },

  switchLedger() {
    wx.redirectTo({ url: "/pages/index/index" });
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
    wx.navigateTo({ url: `/pages/record-detail/index?id=${encodeURIComponent(id)}` });
  },

  reload() {
    this.loadRecords();
  },
});
