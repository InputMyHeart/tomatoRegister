const app = getApp();

function getUsageDays(user) {
  if (!user || !user.createdAt) return 1;
  const createdAt = user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt);
  if (Number.isNaN(createdAt.getTime())) return 1;
  const diff = Date.now() - createdAt.getTime();
  return Math.max(1, Math.floor(diff / 86400000) + 1);
}

Page({
  data: {
    loggedIn: false,
    userName: "番茄用户",
    userAvatar: "/images/brand/tomato-ledger-logo-256-transparent.png",
    userGender: "喵星人",
    usageDays: 1,
    recordCount: 0,
    ledgerCount: 0,
    monthStartDay: 1,
    currentLedger: {
      id: "",
      name: "我家账本",
      roleText: "创建者",
      readonly: false,
    },
  },

  onShow() {
    this.syncAuthState();
  },

  syncAuthState() {
    const { loggedIn, user, currentLedger, stats } = app.globalData;
    if (!loggedIn || !user) {
      this.setData({
        loggedIn: false,
        userName: "微信登录",
        userAvatar: "/images/brand/tomato-ledger-logo-256-transparent.png",
        userGender: "喵星人",
        usageDays: 1,
        recordCount: 0,
        ledgerCount: 0,
      });
      return;
    }

    this.setData({
      loggedIn: true,
      userName: user.nickName || "番茄用户",
      userAvatar: user.avatarUrl || "/images/brand/tomato-ledger-logo-256-transparent.png",
      userGender: user.gender || "喵星人",
      usageDays: getUsageDays(user),
      recordCount: Number((stats && stats.recordCount) || 0),
      ledgerCount: Number((stats && stats.ledgerCount) || 0),
      currentLedger: {
        id: (currentLedger && currentLedger._id) || user.currentLedgerId || "",
        name: (currentLedger && currentLedger.name) || "我家账本",
        roleText: (currentLedger && currentLedger.ownerOpenid === app.globalData.openid) ? "创建者" : "成员",
        readonly: Boolean(currentLedger && currentLedger.readonly),
      },
    });
  },

  handleIdentityTap() {
    if (this.data.loggedIn) {
      this.editProfile();
      return;
    }
    this.login();
  },

  async login() {
    if (this.data.loggedIn) return;
    wx.showLoading({ title: "登录中" });
    try {
      await app.loginWithWechat();
      this.syncAuthState();
      wx.showToast({ title: "登录成功", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "登录失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  editProfile() {
    if (!this.data.loggedIn) return;
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
        this.syncAuthState();
        wx.showToast({ title: "已退出", icon: "none" });
      },
    });
  },

  createLedger() {
    wx.showToast({ title: "创建账本入口已预留", icon: "none" });
  },

  joinLedger() {
    wx.showModal({
      title: "邀请码加入",
      content: "第一版优先支持输入邀请码加入共享账本，同时保留微信分享卡片入口。",
      showCancel: false,
    });
  },

  ledgerConfig() {
    wx.showToast({ title: "账本配置入口已预留", icon: "none" });
  },

  manageCategories() {
    wx.showToast({ title: "分类管理入口已预留", icon: "none" });
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

  viewChangelog() {
    wx.showToast({ title: "更新日志入口已预留", icon: "none" });
  },
});