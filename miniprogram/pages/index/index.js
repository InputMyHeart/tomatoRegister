const app = getApp();

function getMonthLabel() {
  const now = new Date();
  return `${now.getFullYear()}年${now.getMonth() + 1}月`;
}

function money(value) {
  const num = Number(value || 0);
  return num.toFixed(num % 1 === 0 ? 0 : 2);
}

function compactMoney(value) {
  const num = Number(value || 0);
  if (Math.abs(num) >= 100000) return `${(num / 10000).toFixed(1)}万`;
  return money(num);
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
    id: item.id || item._id || "",
    type,
    typeIcon: type === "income" ? "funds-line" : "price-tag-3-line",
    typeIconColor: type === "income" ? "#25a66a" : "#f0442f",
    amountText: money(item.amount),
    noteText: item.note || "未填写备注",
    categoryText,
    selectedTimeText,
    memberName: item.memberName || item.ownerName || "我",
    memberAvatar: item.memberAvatar || "/images/brand/tomato-ledger-logo-256-transparent.png",
  };
}

function normalizeDashboard(data = {}) {
  const recentRecords = Array.isArray(data.recentRecords) ? data.recentRecords.map(normalizeRecord) : [];
  const recordCount = Number(data.recordCount || recentRecords.length || 0);
  return {
    ledgerId: data.ledgerId || "",
    ledgerName: data.ledgerName || "我的账本",
    ledgerType: data.ledgerType || "personal",
    ledgerTypeText: getLedgerTypeText(data.ledgerType),
    monthLabel: getMonthLabel(),
    roleText: data.roleText || getRoleText(data.role),
    readonly: Boolean(data.readonly),
    monthIncome: money(data.monthIncome),
    monthIncomeCompact: compactMoney(data.monthIncome),
    monthExpense: money(data.monthExpense),
    monthExpenseCompact: compactMoney(data.monthExpense),
    balance: money(data.balance),
    balanceCompact: compactMoney(data.balance),
    budget: money(data.budget),
    budgetEnabled: Boolean(data.budgetEnabled),
    budgetLeft: money(data.budgetLeft),
    budgetRate: Number(data.budgetRate || 0),
    recordCount,
    topExpenseCategory: data.topExpenseCategory || "暂无",
    largestExpenseAmount: money(data.largestExpenseAmount),
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
    isSwitchingLedger: false,
    showLedgerInfo: false,
    ledgerId: "",
    ledgerName: "我的账本",
    ledgerType: "personal",
    ledgerTypeText: "个人账本",
    monthLabel: getMonthLabel(),
    roleText: "",
    readonly: false,
    monthIncome: "0", monthIncomeCompact: "0",
    monthExpense: "0", monthExpenseCompact: "0",
    balance: "0", balanceCompact: "0",
    budget: "0",
    budgetEnabled: false,
    budgetLeft: "0",
    budgetRate: 0,
    recordCount: 0,
    topExpenseCategory: "暂无",
    largestExpenseAmount: "0", largestExpenseCompact: "0",
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
      await this.loadLedgers();
      await this.loadDashboard();
    } catch (error) {
      console.warn("home bootstrap failed", error);
      this.setPageStatus("error");
    }
  },

  async loadLedgers() {
    const result = await this.callApi("listLedgers", {});
    const ledgers = result && result.success && result.data ? (result.data.ledgers || []) : [];
    this.setData({ ledgers });
    return ledgers;
  },

  async loadDashboard(ledgerId) {
    const dashboard = await this.callApi("getDashboard", ledgerId ? { ledgerId } : {});
    if (dashboard && dashboard.success && dashboard.data) {
      if (dashboard.data.noLedger) {
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

      const normalized = normalizeDashboard(dashboard.data);
      app.globalData.currentLedger = {
        ...(app.globalData.currentLedger || {}),
        _id: normalized.ledgerId,
        name: normalized.ledgerName,
        type: normalized.ledgerType,
        readonly: normalized.readonly,
        budgetEnabled: normalized.budgetEnabled,
        monthlyBudget: Number(normalized.budget || 0),
        monthStartDay: Number(dashboard.data.monthStartDay || 1),
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

  async callApi(action, data) {
    if (!app.globalData.env) return null;
    try {
      const res = await wx.cloud.callFunction({
        name: "tomatoLedger",
        data: { action, data },
      });
      return res.result;
    } catch (error) {
      console.warn("tomatoLedger fallback", action, error);
      return null;
    }
  },

  noop() {},

  getLedgerRoleTag(item = {}) {
    const openid = app.globalData.openid;
    if (item.role === "owner" || item.ownerOpenid === openid) return "拥有者";
    if (item.role === "readonly" || (item.viewerOpenids || []).includes(openid)) return "访客";
    if (item.role === "member" || (item.memberOpenids || []).includes(openid)) return "成员";
    if (item.readonly) return "访客";
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
        roleClass: roleTag === "拥有者" ? "owner" : roleTag === "访客" ? "visitor" : "member",
        canManage: roleTag === "拥有者",
        isCurrent: id === this.data.ledgerId,
      };
    });
  },

  async switchLedger() {
    const ledgers = this.data.ledgers.length ? this.data.ledgers : await this.loadLedgers();
    if (!ledgers.length) {
      wx.navigateTo({ url: "/pages/ledger-create/index" });
      return;
    }

    this.setData({
      ledgers: this.normalizeLedgers(ledgers),
      isLedgerSwitcherVisible: true,
    });
  },

  closeLedgerSwitcher() {
    if (this.data.isSwitchingLedger) return;
    this.setData({ isLedgerSwitcherVisible: false });
  },

  async chooseLedger(event) {
    const ledgerId = event.currentTarget.dataset.id;
    if (!ledgerId || ledgerId === this.data.ledgerId || this.data.isSwitchingLedger) {
      this.closeLedgerSwitcher();
      return;
    }

    const ledger = this.data.ledgers.find((item) => (item._id || item.id) === ledgerId);
    if (!ledger) return;

    this.setData({ isSwitchingLedger: true });
    wx.showLoading({ title: "切换中" });
    try {
      const saved = await this.callApi("setCurrentLedger", { ledgerId });
      if (!saved || !saved.success) {
        wx.showToast({ title: "切换失败", icon: "none" });
        return;
      }

      const nextLedger = saved.data && saved.data.ledger ? saved.data.ledger : ledger;
      app.globalData.currentLedger = nextLedger;
      app.globalData.readonly = Boolean(nextLedger.readonly || (saved.data && saved.data.role === "readonly"));
      if (app.globalData.user) app.globalData.user.currentLedgerId = ledgerId;
      app.persistAuthState();

      this.setData({ isLedgerSwitcherVisible: false });
      this.setPageStatus("loading");
      await this.loadDashboard(ledgerId);
    } catch (error) {
      console.warn("switch ledger failed", error);
      wx.showToast({ title: "切换失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ isSwitchingLedger: false });
    }
  },

  goBudgetSettings() {
    wx.navigateTo({ url: "/pages/budget-settings/index" });
  },

  goLedgerSettings(event) {
    const ledgerId = event.currentTarget.dataset.id || "";
    this.setData({ isLedgerSwitcherVisible: false });
    wx.navigateTo({ url: `/pages/ledger-detail-settings/index?ledgerId=${encodeURIComponent(ledgerId)}` });
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
