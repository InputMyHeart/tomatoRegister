const app = getApp();
const ledgerService = require("../../services/ledger.service");
const { getId, getLedgerRole } = require("../../utils/mapper");
function normalizeLedger(item = {}, openid = "") {
  const id = getId(item);
  const isOwner = getLedgerRole(openid, item) === "owner";
  const isVisitor = getLedgerRole(openid, item) === "readonly";
  return {
    ...item,
    id,
    displayName: item.name || "未命名账本",
    typeText: item.type === "shared" ? "共享账本" : "个人账本",
    typeClass: item.type === "shared" ? "shared" : "personal",
    roleText: isOwner ? "拥有者" : isVisitor ? "访客" : "成员",
    roleClass: isOwner ? "owner" : isVisitor ? "visitor" : "member",
    memberCount: Array.isArray(item.memberOpenids) ? item.memberOpenids.length : 0,
    visitorCount: Array.isArray(item.viewerOpenids) ? item.viewerOpenids.length : 0,
  };
}
Page({
  data: { loading: true, ledgers: [] },
  onShow() {
    this.loadLedgers();
  },
  async loadLedgers() {
    if (!app.globalData.loggedIn) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.setData({ loading: true });
    try {
      await app.loginWithWechat();
      const data = await ledgerService.listLedgers();
      const rows = data.ledgers || [];
      this.setData({ ledgers: rows.map((item) => normalizeLedger(item, app.globalData.openid)) });
    } catch (_error) {
      wx.showToast({ title: "账本加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },
  openLedgerSettings(event) {
    const ledgerId = event.currentTarget.dataset.id || "";
    if (ledgerId)
      wx.navigateTo({
        url: `/pages/ledger-detail-settings/index?ledgerId=${encodeURIComponent(ledgerId)}`,
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
});
