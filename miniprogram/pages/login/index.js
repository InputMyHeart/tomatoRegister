const app = getApp();
const ledgerService = require("../../services/ledger.service");

function hasCachedAuth() {
  const auth = wx.getStorageSync("tomatoLedgerAuth");
  return Boolean(auth && auth.user);
}

Page({
  data: {
    loggingIn: false,
    inviteCode: "",
    readonlyShareCode: "",
  },

  onLoad(options = {}) {
    this.setData({
      inviteCode: options.inviteCode ? decodeURIComponent(options.inviteCode) : "",
      readonlyShareCode: options.readonlyShareCode
        ? decodeURIComponent(options.readonlyShareCode)
        : "",
    });
    this.enterIndexIfAuthenticated();
  },

  onShow() {
    this.enterIndexIfAuthenticated();
  },

  async enterIndexIfAuthenticated() {
    if (this.data.loggingIn) return;

    if (!app.globalData.loggedIn && hasCachedAuth()) {
      app.restoreAuthState();
    }

    if (app.globalData.loggedIn) {
      if (this.data.inviteCode || this.data.readonlyShareCode) {
        await this.joinSharedLedger();
      }
      wx.reLaunch({ url: "/pages/index/index" });
    }
  },

  async joinSharedLedger() {
    const inviteCode = this.data.inviteCode;
    const readonlyShareCode = this.data.readonlyShareCode;
    if (!inviteCode && !readonlyShareCode) return;

    const data = readonlyShareCode
      ? await ledgerService.joinReadonlyLedger(readonlyShareCode)
      : await ledgerService.joinLedger(inviteCode);
    const ledgerId = data.ledgerId;
    if (ledgerId) {
      await ledgerService.setCurrentLedger(ledgerId);
    }
    await app.loginWithWechat();
    this.setData({ inviteCode: "", readonlyShareCode: "" });
  },

  async login() {
    if (this.data.loggingIn) return;

    this.setData({ loggingIn: true });

    try {
      await app.loginWithWechat();
      if (this.data.inviteCode || this.data.readonlyShareCode) {
        await this.joinSharedLedger();
      }
      wx.reLaunch({ url: "/pages/index/index" });
    } catch (error) {
      wx.showToast({ title: error.message || "登录失败", icon: "none" });
      this.setData({ loggingIn: false });
    }
  },
});
