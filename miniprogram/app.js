const profileService = require("./services/profile.service");
const ledgerStore = require("./services/ledger.store");
const categoryStore = require("./services/category.store");
const { emit } = require("./utils/event-bus");
const { resolveEnvironment } = require("./config/cloud-env");

App({
  globalData: {
    environment: null,
    openid: "",
    user: null,
    currentLedger: null,
    ledgers: [],
    stats: null,
    dataSyncedAt: 0,
    readonly: false,
    loggedIn: false,
  },

  authRequest: null,
  authGeneration: 0,
  authVerifiedInSession: false,
  ledgerSyncTimer: null,
  ledgerSyncActive: false,

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

  onShow() {
    this.startLedgerAutoSync();
  },

  onHide() {
    this.stopLedgerAutoSync();
  },

  startLedgerAutoSync() {
    this.stopLedgerAutoSync();
    this.ledgerSyncActive = true;
    const run = async () => {
      if (this.globalData.loggedIn) {
        try {
          await ledgerStore.syncLedgers();
        } catch (error) {
          console.warn("automatic ledger sync failed", error);
        }
      }
      if (this.ledgerSyncActive) {
        this.ledgerSyncTimer = setTimeout(run, ledgerStore.DEFAULT_SYNC_INTERVAL_MS);
      }
    };
    run();
  },

  stopLedgerAutoSync() {
    this.ledgerSyncActive = false;
    if (this.ledgerSyncTimer) clearTimeout(this.ledgerSyncTimer);
    this.ledgerSyncTimer = null;
  },

  restoreAuthState() {
    const auth = wx.getStorageSync("tomatoLedgerAuth");
    if (!auth || !auth.user) return;
    if (!this.globalData.environment || auth.environmentKey !== this.globalData.environment.key) {
      wx.removeStorageSync("tomatoLedgerAuth");
      ledgerStore.clearLedgers();
      categoryStore.clearAll();
      return;
    }
    this.globalData.openid = auth.openid || "";
    this.globalData.user = auth.user;
    this.globalData.ledgers = ledgerStore.getCachedLedgers(this);
    this.globalData.currentLedger =
      this.globalData.ledgers.find(
        (ledger) => (ledger._id || ledger.id) === auth.user.currentLedgerId
      ) || null;
    this.globalData.stats = null;
    this.globalData.readonly = Boolean(
      this.globalData.currentLedger && this.globalData.currentLedger.readonly
    );
    this.globalData.loggedIn = true;
  },

  persistAuthState() {
    wx.setStorageSync("tomatoLedgerAuth", {
      openid: this.globalData.openid,
      user: this.globalData.user,
      environmentKey: this.globalData.environment && this.globalData.environment.key,
    });
    emit("ledger:current-changed");
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

    const requestGeneration = this.authGeneration;
    this.authRequest = profileService
      .login()
      .then((auth) => {
        if (requestGeneration !== this.authGeneration) throw new Error("登录状态已变化，请重试");
        if (this.globalData.openid && this.globalData.openid !== auth.openid) {
          ledgerStore.clearLedgers();
          categoryStore.clearAll();
          this.globalData.dataSyncedAt = 0;
        }
        this.globalData.openid = auth.openid || "";
        this.globalData.user = auth.user || null;
        this.globalData.currentLedger = auth.currentLedger || null;
        this.globalData.ledgers = ledgerStore.getCachedLedgers(this);
        this.globalData.stats = auth.stats || null;
        this.globalData.readonly = Boolean(auth.currentLedger && auth.currentLedger.readonly);
        this.globalData.loggedIn = true;
        this.authVerifiedInSession = true;
        this.persistAuthState();
        this.startLedgerAutoSync();
        return auth;
      })
      .catch((error) => {
        console.error("tomatoLedger login failed", error);
        throw error;
      })
      .finally(() => {
        if (requestGeneration === this.authGeneration) this.authRequest = null;
      });
    return this.authRequest;
  },

  async updateProfile(profile = {}) {
    const requestGeneration = this.authGeneration;
    const data = await profileService.updateProfile(profile);
    if (requestGeneration !== this.authGeneration) throw new Error("登录状态已变化，请重试");
    const user = data.user;
    this.globalData.user = user || this.globalData.user;
    this.persistAuthState();
    return user;
  },

  logout() {
    this.authGeneration += 1;
    categoryStore.clearAll();
    this.globalData.dataSyncedAt = 0;
    this.globalData.openid = "";
    this.globalData.user = null;
    this.globalData.currentLedger = null;
    this.globalData.ledgers = [];
    this.globalData.stats = null;
    ledgerStore.clearLedgers();
    this.globalData.readonly = false;
    this.globalData.loggedIn = false;
    this.authVerifiedInSession = false;
    this.authRequest = null;
    this.stopLedgerAutoSync();
    wx.removeStorageSync("tomatoLedgerAuth");
    emit("ledger:current-changed");
  },
});
