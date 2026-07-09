const app = getApp();

function clampBudget(value) {
  const numberValue = Math.floor(Number(value || 1));
  if (Number.isNaN(numberValue)) return 1;
  return Math.min(999999, Math.max(1, numberValue));
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
      monthlyBudget: clampBudget(ledger.monthlyBudget || 3000),
      readonly: Boolean(ledger.readonly),
    });
  },

  onEnableChange(event) {
    this.setData({ budgetEnabled: Boolean(event.detail.value) });
  },

  onSliderChange(event) {
    this.setData({ monthlyBudget: clampBudget(event.detail.value) });
  },

  onBudgetInput(event) {
    this.setData({ monthlyBudget: clampBudget(event.detail.value) });
  },

  async saveBudget() {
    if (this.data.readonly) {
      wx.showToast({ title: "访客不能设置预算", icon: "none" });
      return;
    }
    if (this.data.saving) return;
    this.setData({ saving: true });
    wx.showLoading({ title: "保存中" });
    try {
      const res = await wx.cloud.callFunction({
        name: "tomatoLedger",
        data: {
          action: "updateBudget",
          data: {
            ledgerId: this.data.ledgerId,
            budgetEnabled: this.data.budgetEnabled,
            monthlyBudget: this.data.monthlyBudget,
          },
        },
      });
      const result = res.result || {};
      if (!result.success) throw new Error(result.message || "保存失败");

      const ledger = result.data && result.data.ledger;
      if (ledger) {
        app.globalData.currentLedger = {
          ...(app.globalData.currentLedger || {}),
          ...ledger,
        };
        app.persistAuthState();
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
