const app = getApp();
const ledgerService = require("../../services/ledger.service");
const { resolveAvatarUrls } = require("../../utils/avatar");
const ledgerStore = require("../../services/ledger.store");

function normalizeMember(item = {}) {
  const role = ["owner", "member", "visitor"].includes(item.role) ? item.role : "member";
  return {
    ...item,
    role,
    roleClass: role,
    roleText: role === "owner" ? "拥有者" : role === "visitor" ? "访客" : "成员",
    isOwner: role === "owner",
  };
}

function getShareOptions(ledger = {}) {
  return ledger.type === "shared"
    ? [
        {
          mode: "member",
          title: "邀请成为成员",
          desc: "可记账、编辑自己的记录",
          icon: "group-line",
        },
        { mode: "visitor", title: "邀请成为访客", desc: "可查看账本数据", icon: "eye-line" },
      ]
    : [{ mode: "visitor", title: "邀请成为访客", desc: "对方可查看账本数据", icon: "eye-line" }];
}

Page({
  data: {
    loading: true,
    error: false,
    ledgerId: "",
    ledgerName: "成员管理",
    ledger: {},
    members: [],
    canManage: false,
    shareSheetVisible: false,
    shareOptions: [],
    shareMode: "visitor",
  },
  onShow() {
    this.loadMembers();
  },
  async loadMembers() {
    if (!app.globalData.loggedIn) return wx.reLaunch({ url: "/pages/login/index" });
    this.setData({ loading: true, error: false });
    try {
      await app.loginWithWechat();
      const data = await ledgerService.getLedgerMembers();
      const members = (await resolveAvatarUrls(data.members || [])).map(normalizeMember);
      this.setData({
        loading: false,
        ledgerId: (data.ledger && data.ledger.id) || "",
        ledgerName: (data.ledger && data.ledger.name) || "成员管理",
        ledger: data.ledger || {},
        members,
        canManage: Boolean(data.canManage),
      });
    } catch (error) {
      console.warn("member list load failed", error);
      this.setData({ loading: false, error: true });
    }
  },
  removeMember(event) {
    const openid = event.currentTarget.dataset.openid;
    const name = event.currentTarget.dataset.name || "该成员";
    if (!openid || !this.data.canManage) return;
    wx.showModal({
      title: "移除成员",
      content: `确认将${name}移出当前账本吗？`,
      confirmText: "移除",
      confirmColor: "#f0442f",
      success: async (result) => {
        if (!result.confirm) return;
        wx.showLoading({ title: "正在移除" });
        try {
          await ledgerService.removeLedgerMember(openid, this.data.ledgerId);
          await ledgerStore.refreshLedgers();
          wx.showToast({ title: "已移除", icon: "success" });
          this.loadMembers();
        } catch (error) {
          wx.showToast({ title: error.message || "移除失败", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },
  async inviteLedger() {
    if (!this.data.canManage) return;
    wx.showLoading({ title: "准备分享" });
    try {
      const options = await Promise.all(
        getShareOptions(this.data.ledger).map(async (item) => {
          const data = await ledgerService.createLedgerInviteToken({
            ledgerId: this.data.ledgerId,
            mode: item.mode,
          });
          if (!data.token) throw new Error("分享准备失败");
          return { ...item, inviteToken: data.token };
        })
      );
      this.setData({ shareSheetVisible: true, shareOptions: options, shareMode: options[0].mode });
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
    const mode = (options.target && options.target.dataset.mode) || this.data.shareMode;
    const option =
      this.data.shareOptions.find((item) => item.mode === mode) || this.data.shareOptions[0] || {};
    return {
      title: mode === "visitor" ? `查看 ${this.data.ledgerName}` : `加入 ${this.data.ledgerName}`,
      path: `/pages/ledger-join-result/index?inviteToken=${encodeURIComponent(option.inviteToken || "")}`,
    };
  },
});
