const app = getApp();
const ledgerService = require("../../services/ledger.service");

function normalizeBudget(value) {
  const numberValue = Math.round(Number(value) * 100) / 100;
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function isValidBudget(value) {
  return (
    /^\d+(?:\.\d{1,2})?$/.test(String(value)) &&
    normalizeBudget(value) >= 1 &&
    normalizeBudget(value) <= 999999
  );
}

Page({
  data: {
    ledgerId: "",
    ledgerName: "我的账本",
    budgetEnabled: false,
    monthlyBudget: 3000,
    saving: false,
    readonly: false,
  },

  onLoad() {
    const ledger = app.globalData.currentLedger || {};
    this.setData({
      ledgerId: ledger._id || "",
      ledgerName: ledger.name || "我的账本",
      budgetEnabled: Boolean(ledger.budgetEnabled),
      monthlyBudget: String(ledger.monthlyBudget || 3000),
      readonly: Boolean(ledger.readonly),
    });
  },

  onEnableChange(event) {
    this.setData({ budgetEnabled: Boolean(event.detail.value) });
  },

  onBudgetInput(event) {
    this.setData({ monthlyBudget: event.detail.value });
  },

  async saveBudget() {
    if (this.data.readonly) {
      wx.showToast({ title: "访客不能设置预算", icon: "none" });
      return;
    }
    if (this.data.saving) return;
    if (this.data.budgetEnabled && !isValidBudget(this.data.monthlyBudget)) {
      wx.showToast({ title: "预算金额需为 1-999999，最多两位小数", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    wx.showLoading({ title: "保存中" });
    try {
      const data = await ledgerService.updateBudget({
        ledgerId: this.data.ledgerId,
        budgetEnabled: this.data.budgetEnabled,
        monthlyBudget: normalizeBudget(this.data.monthlyBudget),
      });
      const ledger = data.ledger;
      if (ledger) {
        app.globalData.currentLedger = {
          ...(app.globalData.currentLedger || {}),
          ...ledger,
        };
        app.persistAuthState();
        const pages = getCurrentPages();
        const previousPage = pages[pages.length - 2];
        if (previousPage && typeof previousPage.loadDashboard === "function") {
          await previousPage.loadDashboard(ledger._id);
        }
      }
      wx.showToast({ title: "已保存", icon: "success" });
      setTimeout(() => wx.navigateBack(), 650);
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ saving: false });
    }
  },
});
