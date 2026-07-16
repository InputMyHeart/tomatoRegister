const app = getApp();
const ledgerService = require("../../services/ledger.service");
const { formatDisplayMoney } = require("../../utils/money");
const { getId, getLedgerRole } = require("../../utils/mapper");

function getMonthLabel() {
  const now = new Date();
  return `${now.getFullYear()}年${now.getMonth() + 1}月`;
}

function compactMoney(value) {
  const num = Number(value || 0);
  if (Math.abs(num) >= 100000) return `${(num / 10000).toFixed(1)}万`;
  return formatDisplayMoney(num);
}

function getLedgerTypeText(type) {
  return type === "shared" ? "共享账本" : "个人账本";
}

function getRoleText(role) {
  if (role === "owner") return "拥有者";
  if (role === "member") return "成员";
  return "访客";
}

function getStatusFlags(status) {
  return {
    pageStatus: status,
    isLoading: status === "loading",
    isNoLedger: status === "noLedger",
    isEmpty: status === "empty",
    isError: status === "error",
    isReady: status === "ready",
    canRecord: status === "ready" || status === "empty",
  };
}

function normalizeRecord(item = {}) {
  const type = item.type === "income" ? "income" : "expense";
  const categoryText = item.categoryName || item.categoryLabel || "其他";
  const selectedTimeText = item.date || "未选择日期";
  return {
    ...item,
    id: getId(item),
    type,
    typeIcon: type === "income" ? "funds-line" : "price-tag-3-line",
    typeIconColor: type === "income" ? "#25a66a" : "#f0442f",
    amountText: formatDisplayMoney(item.amount),
    noteText: item.note || "未填写备注",
    categoryText,
    selectedTimeText,
    memberName: item.memberName || item.ownerName || "我",
    memberAvatar: item.memberAvatar || "/images/brand/tomato-ledger-logo-256-transparent.png",
  };
}

function normalizeDashboard(data = {}) {
  const recentRecords = Array.isArray(data.recentRecords)
    ? data.recentRecords.map(normalizeRecord)
    : [];
  const recordCount = Number(data.recordCount || recentRecords.length || 0);
  return {
    ledgerId: data.ledgerId || "",
    ledgerName: data.ledgerName || "我的账本",
    ledgerType: data.ledgerType || "personal",
    ledgerTypeText: getLedgerTypeText(data.ledgerType),
    monthLabel: getMonthLabel(),
    roleText: data.roleText || getRoleText(data.role),
    readonly: Boolean(data.readonly),
    monthIncome: formatDisplayMoney(data.monthIncome),
    monthIncomeCompact: compactMoney(data.monthIncome),
    monthExpense: formatDisplayMoney(data.monthExpense),
    monthExpenseCompact: compactMoney(data.monthExpense),
    balance: formatDisplayMoney(data.balance),
    balanceCompact: compactMoney(data.balance),
    budget: formatDisplayMoney(data.budget),
    budgetEnabled: Boolean(data.budgetEnabled),
    budgetLeft: formatDisplayMoney(data.budgetLeft),
    budgetRate: Number(data.budgetRate || 0),
    recordCount,
    topExpenseCategory: data.topExpenseCategory || "暂无",
    largestExpenseAmount: formatDisplayMoney(data.largestExpenseAmount),
    largestExpenseCompact: compactMoney(data.largestExpenseAmount),
    familyMood: data.familyMood || "本月还没有记录",
    recentRecords,
    hasDashboardData: recordCount > 0 || recentRecords.length > 0,
  };
}

Page({
  data: {
    ...getStatusFlags("loading"),
    ledgers: [],
    isLedgerSwitcherVisible: false,
    isLoadingLedgers: false,
    ledgerLoadError: false,
    isSwitchingLedger: false,
    showLedgerInfo: false,
    ledgerId: "",
    ledgerName: "我的账本",
    ledgerType: "personal",
    ledgerTypeText: "个人账本",
    monthLabel: getMonthLabel(),
    roleText: "",
    readonly: false,
    monthIncome: "0",
    monthIncomeCompact: "0",
    monthExpense: "0",
    monthExpenseCompact: "0",
    balance: "0",
    balanceCompact: "0",
    budget: "0",
    budgetEnabled: false,
    budgetLeft: "0",
    budgetRate: 0,
    recordCount: 0,
    topExpenseCategory: "暂无",
    largestExpenseAmount: "0",
    largestExpenseCompact: "0",
    familyMood: "本月还没有记录",
    recentRecords: [],
    hasDashboardData: false,
  },

  onShow() {
    this.bootstrap();
  },

  setPageStatus(status) {
    this.setData(getStatusFlags(status));
  },

  async bootstrap() {
    this.setPageStatus("loading");
    this.setData({ monthLabel: getMonthLabel(), showLedgerInfo: false });
    if (!app.globalData.loggedIn) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }

    try {
      await app.loginWithWechat();
      await this.loadDashboard();
    } catch (error) {
      console.warn("home bootstrap failed", error);
      this.setPageStatus("error");
    }
  },

  async loadLedgers() {
    const data = await ledgerService.listLedgers();
    const ledgers = data.ledgers || [];
    this.setData({ ledgers });
    return ledgers;
  },

  async loadDashboard(ledgerId) {
    const dashboard = await ledgerService.getDashboard(ledgerId);
    if (dashboard) {
      if (dashboard.noLedger) {
        this.setData({
          ledgers: [],
          showLedgerInfo: false,
          ledgerId: "",
          ledgerName: "还没有账本",
          ledgerType: "personal",
          ledgerTypeText: "个人账本",
          monthLabel: getMonthLabel(),
          recentRecords: [],
          recordCount: 0,
          ...getStatusFlags("noLedger"),
        });
        return;
      }

      const normalized = normalizeDashboard(dashboard);
      app.globalData.currentLedger = {
        ...(app.globalData.currentLedger || {}),
        _id: normalized.ledgerId,
        name: normalized.ledgerName,
        type: normalized.ledgerType,
        readonly: normalized.readonly,
        budgetEnabled: normalized.budgetEnabled,
        monthlyBudget: Number(normalized.budget || 0),
        monthStartDay: Number(dashboard.monthStartDay || 1),
      };
      app.globalData.readonly = normalized.readonly;
      app.persistAuthState();
      this.setData({
        ...normalized,
        showLedgerInfo: true,
        ...getStatusFlags(normalized.hasDashboardData ? "ready" : "empty"),
      });
      return;
    }
    this.setPageStatus("error");
  },

  noop() {},

  getLedgerRoleTag(item = {}) {
    const role = getLedgerRole(app.globalData.openid, item);
    if (role === "owner") return "拥有者";
    if (role === "readonly") return "访客";
    return "成员";
  },

  normalizeLedgers(ledgers = []) {
    return ledgers.map((item) => {
      const id = item._id || item.id || "";
      const typeTag = getLedgerTypeText(item.type);
      const roleTag = this.getLedgerRoleTag(item);
      return {
        ...item,
        id,
        displayName: item.name || "未命名账本",
        typeTag,
        typeClass: item.type === "shared" ? "shared" : "personal",
        roleTag,
        roleClass:
          item.role === "owner" ? "owner" : item.role === "readonly" ? "visitor" : "member",
        canManage: roleTag === "拥有者",
        isCurrent: id === this.data.ledgerId,
      };
    });
  },

  async switchLedger() {
    if (this.data.isLoadingLedgers) return;
    this.setData({
      isLedgerSwitcherVisible: true,
      isLoadingLedgers: true,
      ledgerLoadError: false,
    });
    try {
      const ledgers = await this.loadLedgers();
      if (!ledgers.length) {
        this.setData({ isLedgerSwitcherVisible: false });
        wx.navigateTo({ url: "/pages/ledger-create/index" });
        return;
      }
      this.setData({ ledgers: this.normalizeLedgers(ledgers) });
    } catch (error) {
      console.warn("load ledgers for switcher failed", error);
      this.setData({ ledgerLoadError: true });
    } finally {
      this.setData({ isLoadingLedgers: false });
    }
  },

  closeLedgerSwitcher() {
    if (this.data.isSwitchingLedger) return;
    this.setData({ isLedgerSwitcherVisible: false });
  },

  async chooseLedger(event) {
    const ledgerId = event.detail.ledgerId || event.currentTarget.dataset.id;
    if (!ledgerId || ledgerId === this.data.ledgerId || this.data.isSwitchingLedger) {
      this.closeLedgerSwitcher();
      return;
    }

    const ledger = this.data.ledgers.find((item) => (item._id || item.id) === ledgerId);
    if (!ledger) return;

    this.setData({ isSwitchingLedger: true });
    try {
      const saved = await ledgerService.setCurrentLedger(ledgerId);
      if (!saved) {
        wx.showToast({ title: "切换失败", icon: "none" });
        return;
      }

      const nextLedger = saved.ledger || ledger;
      app.globalData.currentLedger = nextLedger;
      app.globalData.readonly = Boolean(nextLedger.readonly || saved.role === "readonly");
      if (app.globalData.user) app.globalData.user.currentLedgerId = ledgerId;
      app.persistAuthState();

      this.setPageStatus("loading");
      await this.loadDashboard(ledgerId);
      this.setData({ isLedgerSwitcherVisible: false });
    } catch (error) {
      console.warn("switch ledger failed", error);
      wx.showToast({ title: "切换失败", icon: "none" });
    } finally {
      this.setData({ isSwitchingLedger: false });
    }
  },

  goBudgetSettings() {
    wx.navigateTo({ url: "/pages/budget-settings/index" });
  },

  goLedgerSettings(event) {
    const ledgerId = event.detail.ledgerId || event.currentTarget.dataset.id || "";
    this.setData({ isLedgerSwitcherVisible: false });
    wx.navigateTo({
      url: `/pages/ledger-detail-settings/index?ledgerId=${encodeURIComponent(ledgerId)}`,
    });
  },
  goCreateLedger() {
    this.setData({ isLedgerSwitcherVisible: false });
    wx.navigateTo({ url: "/pages/ledger-create/index" });
  },

  goRecordEdit() {
    if (this.data.readonly) {
      wx.showToast({ title: "访客不能记账", icon: "none" });
      return;
    }
    if (!this.data.ledgerId) {
      this.goCreateLedger();
      return;
    }
    wx.navigateTo({ url: "/pages/record-category/index" });
  },

  goRecords() {
    wx.redirectTo({ url: "/pages/records/index" });
  },

  goRecordDetail(event) {
    const recordId = event.currentTarget.dataset.id || "";
    if (!recordId) return;
    wx.navigateTo({ url: `/pages/record-edit/index?id=${encodeURIComponent(recordId)}` });
  },
});
