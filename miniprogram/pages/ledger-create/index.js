const app = getApp();

const ledgerTypes = [
  {
    key: "personal",
    title: "个人账本",
    subtitle: "只为自己记录，清楚看见每一笔日常",
    icon: "user-3-line",
    accent: "#f0442f",
    soft: "#fff0ea",
    tint: "rgba(240, 68, 47, 0.12)",
  },
  {
    key: "shared",
    title: "共享账本",
    subtitle: "和Ta们一起记，收入支出都更清晰",
    icon: "group-line",
    accent: "#e9843a",
    soft: "#fff5e7",
    tint: "rgba(233, 132, 58, 0.16)",
  },
];

Page({
  data: {
    ledgerTypes,
    selectedType: "personal",
    stage: "type",
    name: "",
    remark: "",
    saving: false,
    createdLedger: null,
    createdLedgerId: "",
    resultVisible: false,
  },

  selectType(event) {
    const selectedType = event.currentTarget.dataset.type || "personal";
    this.setData({ selectedType });
    setTimeout(() => this.setData({ stage: "details" }), 120);
  },

  backToType() {
    if (this.data.saving) return;
    this.setData({ stage: "type" });
  },

  onNameInput(event) {
    this.setData({ name: event.detail.value });
  },

  onRemarkInput(event) {
    this.setData({ remark: event.detail.value });
  },

  async createLedger() {
    if (this.data.saving) return;
    const name = this.data.name.trim();
    const remark = this.data.remark.trim();
    const nameLength = Array.from(name).length;

    if (nameLength < 1 || nameLength > 8) {
      wx.showToast({ title: "账本名称需为1-8个字符", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    try {
      const res = await wx.cloud.callFunction({
        name: "tomatoLedger",
        data: {
          action: "createLedger",
          data: {
            type: this.data.selectedType,
            name,
            remark,
          },
        },
      });
      const result = res.result || {};
      if (!result.success) throw new Error(result.message || "创建失败");

      const payload = result.data || {};
      const ledger = payload.ledger || {};
      app.globalData.currentLedger = ledger;
      if (app.globalData.user) app.globalData.user.currentLedgerId = payload.ledgerId || ledger._id || "";
      app.persistAuthState();

      this.setData({
        createdLedger: ledger,
        createdLedgerId: payload.ledgerId || ledger._id || "",
        resultVisible: true,
      });
    } catch (error) {
      wx.showToast({ title: error.message || "创建失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  closeResult() {
    wx.navigateBack();
  },

  goRecord() {
    const ledgerId = this.data.createdLedgerId;
    wx.redirectTo({ url: `/pages/record-category/index?ledgerId=${encodeURIComponent(ledgerId)}` });
  },


  onShareAppMessage() {
    const ledger = this.data.createdLedger || {};
    return {
      title: `邀请你加入「${ledger.name || "番茄账本"}」`,
      path: `/pages/login/index?inviteCode=${encodeURIComponent(ledger.inviteCode || "")}`,
    };
  },
});