const profileService = require("./services/profile.service");
const { resolveEnvironment } = require("./config/cloud-env");

App({
  globalData: {
    environment: null,
    openid: "",
    user: null,
    currentLedger: null,
    stats: null,
    readonly: false,
    loggedIn: false,
  },

  authRequest: null,
  authVerifiedInSession: false,

  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      return;
    }

    try {
      const account = wx.getAccountInfoSync ? wx.getAccountInfoSync() : {};
      const envVersion = (account.miniProgram && account.miniProgram.envVersion) || "develop";
      const environment = resolveEnvironment(envVersion);
      wx.cloud.init({ env: environment.id, traceUser: true });
      this.globalData.environment = environment;
      this.restoreAuthState();
    } catch (error) {
      console.error("cloud environment initialization failed", error);
      wx.showModal({
        title: "云环境未配置",
        content: "请在 miniprogram/config/cloud-env.js 填写对应环境 ID。",
        showCancel: false,
      });
    }
  },

  restoreAuthState() {
    const auth = wx.getStorageSync("tomatoLedgerAuth");
    if (!auth || !auth.user) return;
    if (!this.globalData.environment || auth.environmentKey !== this.globalData.environment.key) {
      wx.removeStorageSync("tomatoLedgerAuth");
      return;
    }
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
      environmentKey: this.globalData.environment && this.globalData.environment.key,
    });
  },

  loginWithWechat(options = {}) {
    const force = Boolean(options.force);
    if (!force && this.globalData.loggedIn && this.authVerifiedInSession) {
      return Promise.resolve({
        openid: this.globalData.openid,
        user: this.globalData.user,
        currentLedger: this.globalData.currentLedger,
        stats: this.globalData.stats,
      });
    }
    if (this.authRequest) return this.authRequest;

    this.authRequest = profileService
      .login()
      .then((auth) => {
        this.globalData.openid = auth.openid || "";
        this.globalData.user = auth.user || null;
        this.globalData.currentLedger = auth.currentLedger || null;
        this.globalData.stats = auth.stats || null;
        this.globalData.readonly = Boolean(auth.currentLedger && auth.currentLedger.readonly);
        this.globalData.loggedIn = true;
        this.authVerifiedInSession = true;
        this.persistAuthState();
        return auth;
      })
      .catch((error) => {
        console.error("tomatoLedger login failed", error);
        throw error;
      })
      .finally(() => {
        this.authRequest = null;
      });
    return this.authRequest;
  },

  async updateProfile(profile = {}) {
    const data = await profileService.updateProfile(profile);
    const user = data.user;
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
    this.authVerifiedInSession = false;
    this.authRequest = null;
    wx.removeStorageSync("tomatoLedgerAuth");
  },
});
