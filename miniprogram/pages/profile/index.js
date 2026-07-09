const app = getApp();

function normalizeCreatedAt(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value.$date) return new Date(value.$date);
  if (value.seconds) return new Date(value.seconds * 1000);
  return new Date(value);
}

function getUsageDays(user) {
  if (!user || !user.createdAt) return 1;
  const createdAt = normalizeCreatedAt(user.createdAt);
  if (!createdAt || Number.isNaN(createdAt.getTime())) return 1;
  const createdDay = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(1, Math.floor((today - createdDay) / 86400000) + 1);
}

Page({
  data: {
    userName: "番茄用户",
    userAvatar: "/images/brand/tomato-ledger-logo-256-transparent.png",
    userGender: "喵星人",
    usageDays: 1,
    recordCount: 0,
    ledgerCount: 0,
    monthStartDay: 1,
    readonly: false,
    currentLedger: {
      id: "",
      name: "我家账本",
      roleText: "创建者",
      readonly: false,
    },
  },

  onShow() {
    this.syncAuthState();
    this.refreshHeroData();
  },

  syncAuthState() {
    const { user, currentLedger, stats } = app.globalData;
    if (!user) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }

    this.setData({
      userName: user.nickName || "番茄用户",
      userAvatar: user.avatarUrl || "/images/brand/tomato-ledger-logo-256-transparent.png",
      userGender: user.gender || "喵星人",
      usageDays: getUsageDays(user),
      recordCount: Number((stats && stats.recordCount) || 0),
      ledgerCount: Number((stats && stats.ledgerCount) || 0),
      readonly: Boolean(currentLedger && currentLedger.readonly),
      currentLedger: {
        id: (currentLedger && currentLedger._id) || user.currentLedgerId || "",
        name: (currentLedger && currentLedger.name) || "我家账本",
        roleText: (currentLedger && currentLedger.ownerOpenid === app.globalData.openid) ? "创建者" : "成员",
        readonly: Boolean(currentLedger && currentLedger.readonly),
      },
    });
  },

  async refreshHeroData() {
    if (this.refreshingHero || !app.globalData.loggedIn) return;
    this.refreshingHero = true;
    try {
      await app.loginWithWechat();
      this.syncAuthState();
    } catch (error) {
      console.error("refresh profile hero failed", error);
    } finally {
      this.refreshingHero = false;
    }
  },


  async callApi(action, data = {}) {
    const res = await wx.cloud.callFunction({
      name: "tomatoLedger",
      data: { action, data },
    });
    return res.result || {};
  },
  handleIdentityTap() {
    this.editProfile();
  },

  editProfile() {
    wx.navigateTo({ url: "/pages/profile-edit/index" });
  },

  logout() {
    wx.showModal({
      title: "退出账号",
      content: "退出后，本机将不再显示当前微信登录状态。",
      confirmText: "退出",
      confirmColor: "#f0442f",
      success: (res) => {
        if (!res.confirm) return;
        app.logout();
        wx.reLaunch({ url: "/pages/login/index" });
        wx.showToast({ title: "已退出", icon: "none" });
      },
    });
  },

  createLedger() {
    wx.navigateTo({ url: "/pages/ledger-create/index" });
  },

  joinLedger() {
    wx.showModal({
      title: "邀请码加入",
      content: "第一版优先支持输入邀请码加入共享账本，同时保留微信分享卡片入口。",
      showCancel: false,
    });
  },

  ledgerSettings() {
    wx.navigateTo({ url: "/pages/ledger-settings/index" });
  },

  manageCategories() {
    wx.showToast({ title: "分类管理入口已预留", icon: "none" });
  },

  manageQuickAmounts() {
    wx.showToast({ title: "快捷金额入口已预留", icon: "none" });
  },

  manageAccounts() {
    wx.showToast({ title: "支付账户入口已预留", icon: "none" });
  },

  manageBudget() {
    wx.showToast({ title: "预算设置入口已预留", icon: "none" });
  },

  manageMonthStartDay() {
    wx.showToast({ title: "月度起始日入口已预留", icon: "none" });
  },

  importBill() {
    wx.showToast({ title: "导入账单入口已预留", icon: "none" });
  },

  exportBill() {
    wx.showToast({ title: "导出账单入口已预留", icon: "none" });
  },

  feedback() {
    wx.showToast({ title: "意见反馈入口已预留", icon: "none" });
  },


  resetDatabase() {
    wx.showModal({
      title: "重置数据库",
      content: "此操作会清空所有账本、分类、记录和邀请数据，用户信息会保留。确定继续吗？",
      confirmText: "清空",
      confirmColor: "#c55249",
      success: (res) => {
        if (!res.confirm) return;
        this.confirmResetDatabase();
      },
    });
  },

  async confirmResetDatabase() {
    wx.showLoading({ title: "清空中" });
    try {
      const result = await this.callApi("resetDatabase", { confirm: "RESET_TOMATO_LEDGER_DATABASE" });
      if (!result || !result.success) {
        wx.showToast({ title: (result && result.message) || "重置失败", icon: "none" });
        return;
      }
      app.globalData.currentLedger = null;
      app.globalData.stats = null;
      if (app.globalData.user) app.globalData.user.currentLedgerId = "";
      app.persistAuthState();
      wx.reLaunch({ url: "/pages/index/index" });
      wx.showToast({ title: "已清空", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "重置失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },
  viewChangelog() {
    wx.showToast({ title: "更新日志入口已预留", icon: "none" });
  },
});