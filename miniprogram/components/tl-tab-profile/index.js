const app = getApp();
const { syncData } = require("../../services/data-sync.service");
const feedback = require("../../services/feedback-ui");
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
    syncing: false,
    lastSyncedText: "尚未同步",
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
      this.setData({ lastSyncedText: this.formatSyncedAt(app.globalData.dataSyncedAt) });
      this.refreshHeroData();
    },
  },

  methods: {
    formatSyncedAt(value) {
      if (!value) return "尚未同步";
      const date = new Date(value);
      return `上次同步 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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

    refreshAfterSync() {
      if (this.data.syncing) return;
      this.syncAuthState();
      this.refreshHeroData();
    },

    async syncData() {
      if (this.data.syncing) return;
      this.setData({ syncing: true });
      try {
        const result = await syncData();
        this.syncAuthState();
        this.setData({ lastSyncedText: this.formatSyncedAt(result.syncedAt || Date.now()) });
        feedback.showToast({
          type: "success",
          message: "同步完成",
        });
      } catch (error) {
        feedback.showToast({ type: "error", message: error.message || "同步失败" });
      } finally {
        this.setData({ syncing: false });
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
          feedback.showToast({ type: "info", message: "已退出" });
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
        feedback.showReadonlyToast();
        return;
      }
      wx.navigateTo({ url: "/pages/record-import/index" });
    },

    exportBill() {
      feedback.showToast({ type: "info", message: "导出账单入口已预留" });
    },

    feedback() {
      wx.navigateTo({ url: "/pages/feedback/index" });
    },

    viewChangelog() {
      feedback.showToast({ type: "info", message: "更新日志入口已预留" });
    },
  },
});
