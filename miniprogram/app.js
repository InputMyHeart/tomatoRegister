App({
  globalData: {
    env: "cloudbase-d1gf17yiu8b68f2ad",
    openid: "",
    user: null,
    currentLedger: null,
    stats: null,
    readonly: false,
    loggedIn: false,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      return;
    }

    const cloudOptions = { traceUser: true };
    if (this.globalData.env) {
      cloudOptions.env = this.globalData.env;
    }
    wx.cloud.init(cloudOptions);

    this.restoreAuthState();
  },

  restoreAuthState() {
    const auth = wx.getStorageSync("tomatoLedgerAuth");
    if (!auth || !auth.user) return;
    this.globalData.openid = auth.openid || "";
    this.globalData.user = auth.user;
    this.globalData.currentLedger = auth.currentLedger || null;
    this.globalData.stats = auth.stats || null;
    this.globalData.readonly = Boolean(auth.currentLedger && auth.currentLedger.readonly);
    this.globalData.loggedIn = true;
  },

  persistAuthState() {
    wx.setStorageSync("tomatoLedgerAuth", {
      openid: this.globalData.openid,
      user: this.globalData.user,
      currentLedger: this.globalData.currentLedger,
      stats: this.globalData.stats,
    });
  },

  async loginWithWechat() {
    try {
      const res = await wx.cloud.callFunction({
        name: "tomatoLedger",
        data: {
          action: "login",
          data: {},
        },
      });

      const result = res.result || {};
      if (!result.success) {
        throw new Error(result.message || "登录失败，请稍后重试");
      }

      const auth = result.data || {};
      this.globalData.openid = auth.openid || "";
      this.globalData.user = auth.user || null;
      this.globalData.currentLedger = auth.currentLedger || null;
      this.globalData.stats = auth.stats || null;
      this.globalData.readonly = Boolean(auth.currentLedger && auth.currentLedger.readonly);
      this.globalData.loggedIn = true;
      this.persistAuthState();

      return auth;
    } catch (error) {
      console.error("tomatoLedger login failed", error);
      throw error;
    }
  },

  async updateProfile(profile = {}) {
    const res = await wx.cloud.callFunction({
      name: "tomatoLedger",
      data: {
        action: "updateProfile",
        data: profile,
      },
    });

    const result = res.result || {};
    if (!result.success) {
      throw new Error(result.message || "保存失败，请稍后重试");
    }

    const user = result.data && result.data.user;
    this.globalData.user = user || this.globalData.user;
    this.persistAuthState();
    return user;
  },

  logout() {
    this.globalData.openid = "";
    this.globalData.user = null;
    this.globalData.currentLedger = null;
    this.globalData.stats = null;
    this.globalData.readonly = false;
    this.globalData.loggedIn = false;
    wx.removeStorageSync("tomatoLedgerAuth");
  },
});