const app = getApp();

function normalizeLedger(item = {}, openid = "", currentLedgerId = "") {
  const id = item._id || item.id || "";
  const isOwner = item.ownerOpenid === openid || item.role === "owner";
  const isVisitor = item.role === "readonly" || (item.viewerOpenids || []).includes(openid) || item.readonly;
  const roleText = isOwner ? "拥有者" : isVisitor ? "访客" : "成员";
  const remark = String(item.remark || "").trim();
  return {
    ...item,
    id,
    displayName: item.name || "未命名账本",
    remarkText: remark || "暂无备注",
    hasRemark: Boolean(remark),
    typeText: item.type === "shared" ? "共享账本" : "个人账本",
    typeClass: item.type === "shared" ? "shared" : "personal",
    roleText,
    roleClass: isOwner ? "owner" : isVisitor ? "visitor" : "member",
    isOwner,
    isCurrent: id === currentLedgerId,
    memberCount: Array.isArray(item.memberOpenids) ? item.memberOpenids.length : 0,
    visitorCount: Array.isArray(item.viewerOpenids) ? item.viewerOpenids.length : 0,
  };
}

function getShareOptions(ledger = {}) {
  if (ledger.type === "shared") {
    return [
      {
        mode: "member",
        title: "邀请成为成员",
        desc: "可记账、编辑自己的记录，适合一起管理账本的人。",
        icon: "group-line",
      },
      {
        mode: "visitor",
        title: "邀请成为访客",
        desc: "仅可查看账本数据，适合只需要了解情况的人。",
        icon: "eye-line",
      },
    ];
  }

  return [
    {
      mode: "visitor",
      title: "邀请成为访客",
      desc: "个人账本仅支持可读分享，对方只能查看账本数据。",
      icon: "eye-line",
    },
  ];
}

Page({
  data: {
    loading: true,
    deletingLedgerId: "",
    ledgers: [],
    focusLedgerId: "",
    shareSheetVisible: false,
    shareLedger: null,
    shareOptions: [],
    shareMode: "visitor",
  },

  onLoad(options = {}) {
    this.setData({ focusLedgerId: options.ledgerId || "" });
  },

  onShow() {
    if (this.data.shareSheetVisible) this.closeShareSheet();
    this.loadLedgers();
  },

  async callApi(action, data = {}) {
    if (!app.globalData.env) return null;
    try {
      const res = await wx.cloud.callFunction({
        name: "tomatoLedger",
        data: { action, data },
      });
      return res.result;
    } catch (error) {
      console.warn("tomatoLedger fallback", action, error);
      return null;
    }
  },

  async loadLedgers() {
    if (!app.globalData.loggedIn) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }

    this.setData({ loading: true });
    try {
      await app.loginWithWechat();
      const result = await this.callApi("listLedgers", {});
      const rows = result && result.success && result.data ? (result.data.ledgers || []) : [];
      const currentLedgerId = (app.globalData.currentLedger && app.globalData.currentLedger._id) || (app.globalData.user && app.globalData.user.currentLedgerId) || "";
      this.setData({
        ledgers: rows.map((item) => normalizeLedger(item, app.globalData.openid, currentLedgerId)),
      });
    } catch (error) {
      wx.showToast({ title: "账本加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  findLedger(event) {
    const ledgerId = event.currentTarget.dataset.id;
    return this.data.ledgers.find((item) => item.id === ledgerId);
  },

  async inviteLedger(event) {
    const ledger = this.findLedger(event);
    if (!ledger || !ledger.isOwner) {
      wx.showToast({ title: "仅拥有者可邀请", icon: "none" });
      return;
    }

    wx.showLoading({ title: "准备分享" });
    try {
      const shareOptions = getShareOptions(ledger);
      const optionsWithToken = await Promise.all(shareOptions.map(async (item) => {
        const result = await this.callApi("createLedgerInviteToken", { ledgerId: ledger.id, mode: item.mode });
        if (!result || !result.success || !result.data || !result.data.token) {
          throw new Error((result && result.message) || "分享准备失败");
        }
        return { ...item, inviteToken: result.data.token };
      }));

      this.setData({
        shareSheetVisible: true,
        shareLedger: ledger,
        shareOptions: optionsWithToken,
        shareMode: optionsWithToken[0].mode,
      });
    } catch (error) {
      wx.showToast({ title: error.message || "分享准备失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  closeShareSheet() {
    this.setData({ shareSheetVisible: false });
  },

  stopSheetTap() {},

  selectShareMode(event) {
    this.setData({ shareMode: event.currentTarget.dataset.mode || "visitor" });
  },

  onShareAppMessage(options = {}) {
    const ledger = this.data.shareLedger || {};
    if (this.data.shareSheetVisible) this.closeShareSheet();
    const requestedMode = options.target && options.target.dataset ? options.target.dataset.mode : this.data.shareMode;
    const mode = ledger.type === "personal" ? "visitor" : (requestedMode || "visitor");
    const shareOption = this.data.shareOptions.find((item) => item.mode === mode) || this.data.shareOptions[0] || {};
    const name = ledger.displayName || ledger.name || "番茄账本";
    const inviteToken = shareOption.inviteToken || "";

    return {
      title: mode === "visitor" ? `邀请你查看《${name}》` : `邀请你加入《${name}》`,
      path: `/pages/ledger-join-result/index?inviteToken=${encodeURIComponent(inviteToken)}`,
    };
  },

  editLedger(event) {
    const ledger = this.findLedger(event);
    if (!ledger || !ledger.isOwner) {
      wx.showToast({ title: "仅拥有者可编辑", icon: "none" });
      return;
    }
    wx.showToast({ title: "编辑入口已预留", icon: "none" });
  },

  manageMembers(event) {
    const ledger = this.findLedger(event);
    if (!ledger || !ledger.isOwner) {
      wx.showToast({ title: "仅拥有者可管理成员", icon: "none" });
      return;
    }
    wx.showToast({ title: "成员入口已预留", icon: "none" });
  },

  deleteLedger(event) {
    const ledger = this.findLedger(event);
    if (!ledger || !ledger.isOwner) {
      wx.showToast({ title: "仅拥有者可删除", icon: "none" });
      return;
    }

    wx.showModal({
      title: "删除账本",
      content: `确定删除「${ledger.displayName}」吗？删除后账本记录也会一并移除。`,
      confirmText: "删除",
      confirmColor: "#d9483b",
      success: async (res) => {
        if (!res.confirm || this.data.deletingLedgerId) return;
        this.setData({ deletingLedgerId: ledger.id });
        wx.showLoading({ title: "删除中" });
        try {
          const result = await this.callApi("deleteLedger", { ledgerId: ledger.id });
          if (!result || !result.success) {
            wx.showToast({ title: (result && result.message) || "删除失败", icon: "none" });
            return;
          }

          const currentLedgerId = result.data && result.data.currentLedgerId;
          if (app.globalData.user) app.globalData.user.currentLedgerId = currentLedgerId || "";
          app.globalData.currentLedger = (result.data && result.data.currentLedger) || null;
          app.persistAuthState();
          await this.loadLedgers();
          wx.showToast({ title: "已删除", icon: "success" });
        } catch (error) {
          console.warn("delete ledger failed", error);
          wx.showToast({ title: "删除失败", icon: "none" });
        } finally {
          wx.hideLoading();
          this.setData({ deletingLedgerId: "" });
        }
      },
    });
  },
});