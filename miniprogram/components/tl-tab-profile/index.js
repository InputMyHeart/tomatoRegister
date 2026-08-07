const app = getApp();
const profileService = require("../../services/profile.service");
const ledgerStore = require("../../services/ledger.store");
const { getId } = require("../../utils/mapper");

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
  const createdDay = new Date(
    createdAt.getFullYear(),
    createdAt.getMonth(),
    createdAt.getDate()
  ).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(1, Math.floor((today - createdDay) / 86400000) + 1);
}

Component({
  data: {
    userName: "番茄用户",
    userAvatar: "/images/brand/tomato-ledger-logo-256-transparent.png",

    usageDays: 1,
    recordCount: 0,
    ledgerCount: 0,
    readonly: false,
    currentLedger: {
      id: "",
      name: "我家账本",
      roleText: "拥有者",
      readonly: false,
    },
  },

  lifetimes: {
    attached() {
      this.syncAuthState();
      this.refreshHeroData();
    },
  },

  methods: {
    syncAuthState() {
      const { user, currentLedger, stats } = app.globalData;
      if (!user) {
        wx.reLaunch({ url: "/pages/login/index" });
        return;
      }

      this.setData({
        userName: user.nickName || "番茄用户",
        userAvatar: user.avatarUrl || "/images/brand/tomato-ledger-logo-256-transparent.png",

        usageDays: getUsageDays(user),
        recordCount: Number((stats && stats.recordCount) || 0),
        ledgerCount: Number((stats && stats.ledgerCount) || 0),
        readonly: Boolean(currentLedger && currentLedger.readonly),
        currentLedger: {
          id: getId(currentLedger || {}) || user.currentLedgerId || "",
          name: (currentLedger && currentLedger.name) || "我家账本",
          roleText:
            currentLedger && currentLedger.ownerOpenid === app.globalData.openid
              ? "拥有者"
              : currentLedger && currentLedger.readonly
                ? "访客"
                : "成员",
          readonly: Boolean(currentLedger && currentLedger.readonly),
        },
      });
    },

    onAvatarError() {
      this.setData({ userAvatar: "/images/brand/tomato-ledger-logo-256-transparent.png" });
    },

    async refreshHeroData() {
      if (this.refreshingHero || !app.globalData.loggedIn) return;
      this.refreshingHero = true;
      try {
        await app.loginWithWechat({ force: true });
        this.syncAuthState();
      } catch (error) {
        console.error("refresh profile hero failed", error);
      } finally {
        this.refreshingHero = false;
      }
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
        content: "第一版优先支持输入邀请码加入账本，同时保留微信分享卡片入口。",
        showCancel: false,
      });
    },

    ledgerSettings() {
      wx.navigateTo({ url: "/pages/ledger-settings/index" });
    },

    manageMembers() {
      wx.navigateTo({ url: "/pages/member-manage/index" });
    },

    manageCategories() {
      wx.navigateTo({ url: "/pages/category-manage/index" });
    },

    manageQuickAmounts() {
      wx.navigateTo({ url: "/pages/quick-amount-settings/index" });
    },

    manageAccounts() {
      wx.navigateTo({ url: "/pages/payment-account/index" });
    },

    manageBudget() {
      wx.navigateTo({ url: "/pages/budget-settings/index" });
    },

    importBill() {
      if (this.data.readonly) {
        wx.showToast({ title: "访客不能导入账单", icon: "none" });
        return;
      }
      wx.navigateTo({ url: "/pages/record-import/index" });
    },

    exportBill() {
      wx.showToast({ title: "导出账单入口已预留", icon: "none" });
    },

    feedback() {
      wx.navigateTo({ url: "/pages/feedback/index" });
    },

    resetDatabase() {
      wx.showModal({
        title: "重置数据库",
        content:
          "此操作会删除你创建的个人账本及其分类，并清空你自己创建的记录；共享账本和其他成员的数据不会受到影响。确定继续吗？",
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
        await profileService.resetDatabase();
        await app.loginWithWechat({ force: true });
        await ledgerStore.refreshLedgers();
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
  },
});
