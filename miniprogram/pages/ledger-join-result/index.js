const app = getApp();

function decodeOption(value) {
  return value ? decodeURIComponent(value) : "";
}

Page({
  data: {
    status: "checking",
    inviteCode: "",
    readonlyShareCode: "",
    inviteToken: "",
    ledgerId: "",
    ledgerName: "共享账本",
    roleText: "成员",
    isReadonly: false,
    message: "正在确认邀请信息...",
    actionText: "登录并加入",
    busy: false,
    activating: false,
  },

  onLoad(options = {}) {
    const inviteCode = decodeOption(options.inviteCode);
    const readonlyShareCode = decodeOption(options.readonlyShareCode);
    const inviteToken = decodeOption(options.inviteToken);
    this.setData({
      inviteCode,
      readonlyShareCode,
      inviteToken,
      isReadonly: Boolean(readonlyShareCode),
      roleText: readonlyShareCode ? "访客" : "成员",
    });
    this.bootstrap();
  },

  onShow() {
    if (this.data.status === "success" || this.data.busy) return;
    this.bootstrap();
  },

  restoreCachedAuth() {
    if (app.globalData.loggedIn) return;
    const auth = wx.getStorageSync("tomatoLedgerAuth");
    if (auth && auth.user) app.restoreAuthState();
  },

  bootstrap() {
    this.restoreCachedAuth();

    if (!this.data.inviteToken && !this.data.inviteCode && !this.data.readonlyShareCode) {
      this.setData({
        status: "error",
        message: "邀请信息不完整，请让账本拥有者重新分享。",
      });
      return;
    }

    if (!app.globalData.loggedIn) {
      this.setData({
        status: "login",
        message: "登录后才能加入账本。",
        actionText: "登录并加入",
      });
      return;
    }

    this.joinLedger();
  },

  async callApi(action, data = {}) {
    const res = await wx.cloud.callFunction({
      name: "tomatoLedger",
      data: { action, data },
    });
    return res.result || {};
  },

  async loginAndJoin() {
    if (this.data.busy) return;
    this.setData({ busy: true, status: "checking", message: "正在登录..." });
    try {
      await app.loginWithWechat();
      await this.joinLedger();
    } catch (error) {
      this.setData({
        status: "login",
        busy: false,
        message: error.message || "登录失败，请重试。",
        actionText: "重新登录",
      });
    }
  },

  async joinLedger() {
    if (this.data.busy && this.data.status === "joining") return;

    const hasInviteToken = Boolean(this.data.inviteToken);
    const isReadonly = Boolean(this.data.readonlyShareCode);
    const action = hasInviteToken ? "joinLedgerByInviteToken" : (isReadonly ? "joinReadonlyLedger" : "joinLedger");
    const payload = hasInviteToken
      ? { inviteToken: this.data.inviteToken }
      : (isReadonly ? { readonlyShareCode: this.data.readonlyShareCode } : { inviteCode: this.data.inviteCode });

    this.setData({ busy: true, status: "joining", message: "正在加入账本..." });

    try {
      const result = await this.callApi(action, payload);
      if (!result || !result.success) {
        const code = result && result.code;
        const message = (result && result.message) || "加入账本失败，请重试。";
        if (code === "INVITE_NOT_ALLOWED") {
          this.setData({ status: "notice", busy: false, message });
          return;
        }
        throw new Error(message);
      }

      const data = result.data || {};
      const ledgerId = data.ledgerId;
      const ledger = data.ledger;
      const role = data.role || (isReadonly ? "readonly" : "member");
      await app.loginWithWechat();

      if (data.already) {
        this.setData({
          status: "notice",
          busy: false,
          ledgerId: ledgerId || "",
          ledgerName: (ledger && ledger.name) || "共享账本",
          roleText: role === "readonly" ? "访客" : role === "owner" ? "拥有者" : "成员",
          isReadonly: role === "readonly",
          message: data.message || "你已经加入过该账本，无需重复加入",
        });
        return;
      }

      this.setData({
        status: "success",
        busy: false,
        ledgerId: ledgerId || "",
        ledgerName: (ledger && ledger.name) || "共享账本",
        roleText: role === "readonly" ? "访客" : "成员",
        isReadonly: role === "readonly",
        message: data.message || "加入成功",
      });
    } catch (error) {
      this.setData({
        status: "error",
        busy: false,
        message: error.message || "加入账本失败，请重试。",
      });
    }
  },

  async viewLedger() {
    if (this.data.activating) return;
    const ledgerId = this.data.ledgerId;
    if (!ledgerId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }

    this.setData({ activating: true });
    try {
      const current = await this.callApi("setCurrentLedger", { ledgerId });
      if (current && current.success && current.data) {
        const ledger = current.data.ledger || null;
        app.globalData.currentLedger = ledger || app.globalData.currentLedger;
        app.globalData.readonly = Boolean(this.data.isReadonly || current.data.role === "readonly");
        if (app.globalData.user) app.globalData.user.currentLedgerId = ledgerId;
        app.persistAuthState();
      }
      wx.reLaunch({ url: "/pages/index/index" });
    } catch (error) {
      wx.showToast({ title: "切换账本失败", icon: "none" });
      this.setData({ activating: false });
    }
  },

  goHome() {
    wx.reLaunch({ url: "/pages/index/index" });
  },

  retry() {
    if (!app.globalData.loggedIn) {
      this.loginAndJoin();
      return;
    }
    this.joinLedger();
  },
});