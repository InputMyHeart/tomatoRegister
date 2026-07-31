const app = getApp();
const ledgerService = require("../../services/ledger.service");
const ledgerStore = require("../../services/ledger.store");
const { getId, getLedgerRole } = require("../../utils/mapper");
const { resolveAvatarUrls } = require("../../utils/avatar");

function normalizeLedger(item = {}, openid = "") {
  const id = getId(item);
  const role = getLedgerRole(openid, item);
  const remark = String(item.remark || "").trim();
  const isOwner = role === "owner";
  const isVisitor = role === "readonly";
  return {
    ...item,
    id,
    displayName: item.name || "未命名账本",
    remarkText: remark,
    hasRemark: Boolean(remark),
    typeText: item.type === "shared" ? "共享账本" : "个人账本",
    typeClass: item.type === "shared" ? "shared" : "personal",
    roleText: isOwner ? "拥有者" : isVisitor ? "访客" : "成员",
    roleClass: isOwner ? "owner" : isVisitor ? "visitor" : "member",
    isOwner,
    memberCount: Array.isArray(item.memberOpenids) ? item.memberOpenids.length : 0,
    visitorCount: Array.isArray(item.viewerOpenids) ? item.viewerOpenids.length : 0,
    memberAvatars: [],
  };
}

Page({
  data: { loading: true, ledgers: [] },
  onShow() {
    this.loadLedgers();
  },
  async loadLedgers() {
    if (!app.globalData.loggedIn) return wx.reLaunch({ url: "/pages/login/index" });
    this.setData({ loading: true });
    try {
      await app.loginWithWechat();
      const rows = await ledgerStore.getLedgers();
      const ledgers = rows.map((item) => normalizeLedger(item, app.globalData.openid));
      const memberResults = await Promise.all(
        ledgers.map(async (ledger) => {
          try {
            const data = await ledgerService.getLedgerMembers(ledger.id);
            const rows = await resolveAvatarUrls(data.members || []);
            const owners = rows.filter((item) => item.role === "owner");
            const members = rows.filter((item) => item.role === "member");
            const visitors = rows.filter((item) => item.role === "visitor");
            return {
              memberAvatars: [...owners, ...members, ...visitors].slice(0, 10),
              memberCount: owners.length + members.length,
              visitorCount: visitors.length,
              memberLoadFailed: false,
            };
          } catch (error) {
            console.warn("ledger member avatars load failed", ledger.id, error);
            return {
              memberAvatars: [],
              memberLoadFailed: true,
            };
          }
        })
      );
      const hasMemberLoadFailure = memberResults.some((result) => result.memberLoadFailed);
      this.setData({
        ledgers: ledgers.map((ledger, index) => ({
          ...ledger,
          ...(memberResults[index] || {}),
        })),
      });
      if (hasMemberLoadFailure) {
        wx.showToast({ title: "部分成员头像加载失败", icon: "none" });
      }
    } catch (error) {
      console.warn("ledger list load failed", error);
      wx.showToast({ title: "账本加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },
  editLedger() {
    wx.showToast({ title: "编辑账本入口已预留", icon: "none" });
  },
  deleteLedger(event) {
    const ledgerId = event.currentTarget.dataset.id || "";
    const name = event.currentTarget.dataset.name || "该账本";
    if (!ledgerId) return;
    wx.showModal({
      title: "删除账本",
      content: `确认删除“${name}”吗？其中的全部记录也会一并删除。`,
      confirmText: "删除",
      confirmColor: "#d9483b",
      success: async (result) => {
        if (!result.confirm) return;
        wx.showLoading({ title: "正在删除" });
        try {
          const data = await ledgerService.deleteLedger(ledgerId);
          if (app.globalData.user) app.globalData.user.currentLedgerId = data.currentLedgerId || "";
          app.globalData.currentLedger = data.currentLedger || null;
          app.persistAuthState();
          await ledgerStore.refreshLedgers();
          wx.showToast({ title: "已删除", icon: "success" });
          this.loadLedgers();
        } catch (error) {
          wx.showToast({ title: error.message || "删除失败", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },
  createLedger() {
    wx.navigateTo({ url: "/pages/ledger-create/index" });
  },
  joinLedger() {
    wx.showModal({
      title: "邀请码加入",
      content: "当前可通过好友分享的账本链接加入账本。",
      showCancel: false,
    });
  },
});
