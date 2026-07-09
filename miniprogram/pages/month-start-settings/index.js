const app = getApp();

const days = Array.from({ length: 28 }, (_, index) => index + 1);

Page({
  data: {
    ledgerId: "",
    ledgerName: "我的账本",
    days,
    monthStartDay: 1,
    saving: false,
    readonly: false,
  },

  onLoad() {
    const ledger = app.globalData.currentLedger || {};
    this.setData({
      ledgerId: ledger._id || "",
      ledgerName: ledger.name || "我的账本",
      monthStartDay: Number(ledger.monthStartDay || 1),
      readonly: Boolean(ledger.readonly),
    });
  },

  selectDay(event) {
    this.setData({ monthStartDay: Number(event.currentTarget.dataset.day || 1) });
  },

  async saveMonthStartDay() {
    if (this.data.readonly) {
      wx.showToast({ title: "访客不能设置月度起始日", icon: "none" });
      return;
    }
    if (this.data.saving) return;
    this.setData({ saving: true });
    wx.showLoading({ title: "保存中" });
    try {
      const res = await wx.cloud.callFunction({
        name: "tomatoLedger",
        data: {
          action: "updateMonthStartDay",
          data: {
            ledgerId: this.data.ledgerId,
            monthStartDay: this.data.monthStartDay,
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
