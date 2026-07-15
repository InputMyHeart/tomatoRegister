const app = getApp();

function normalizeLedger(item = {}, openid = "") {
  const id = item._id || item.id || "";
  const isOwner = item.ownerOpenid === openid || item.role === "owner";
  const isVisitor = item.role === "readonly" || (item.viewerOpenids || []).includes(openid) || item.readonly;
  const remark = String(item.remark || "").trim();
  return {
    ...item, id, displayName: item.name || "未命名账本", remarkText: remark || "暂无备注", hasRemark: Boolean(remark),
    typeText: item.type === "shared" ? "共享账本" : "个人账本", typeClass: item.type === "shared" ? "shared" : "personal",
    roleText: isOwner ? "拥有者" : isVisitor ? "访客" : "成员", roleClass: isOwner ? "owner" : isVisitor ? "visitor" : "member",
    isOwner, memberCount: Array.isArray(item.memberOpenids) ? item.memberOpenids.length : 0, visitorCount: Array.isArray(item.viewerOpenids) ? item.viewerOpenids.length : 0,
  };
}
function getShareOptions(ledger = {}) {
  return ledger.type === "shared" ? [
    { mode: "member", title: "邀请成为成员", desc: "可记账、编辑自己的记录。", icon: "group-line" },
    { mode: "visitor", title: "邀请成为访客", desc: "可查看账本数据。", icon: "eye-line" },
  ] : [{ mode: "visitor", title: "邀请成为访客", desc: "对方可查看账本数据。", icon: "eye-line" }];
}
Page({
  data: { loading: true, ledger: null, ledgerId: "", deleting: false, shareSheetVisible: false, shareOptions: [], shareMode: "visitor" },
  onLoad(options = {}) { this.setData({ ledgerId: options.ledgerId || "" }); },
  onShow() { if (this.data.shareSheetVisible) this.closeShareSheet(); this.loadLedger(); },
  async callApi(action, data = {}) { try { const res = await wx.cloud.callFunction({ name: "tomatoLedger", data: { action, data } }); return res.result; } catch (error) { console.warn("tomatoLedger", action, error); return null; } },
  async loadLedger() {
    if (!app.globalData.loggedIn) { wx.reLaunch({ url: "/pages/login/index" }); return; }
    this.setData({ loading: true });
    try {
      await app.loginWithWechat();
      const result = await this.callApi("listLedgers");
      const rows = result && result.success && result.data ? result.data.ledgers || [] : [];
      const selected = rows.find((item) => (item._id || item.id) === this.data.ledgerId);
      if (!selected) { wx.showToast({ title: "账本不存在或无权访问", icon: "none" }); wx.navigateBack(); return; }
      this.setData({ ledger: normalizeLedger(selected, app.globalData.openid) });
    } catch (error) { wx.showToast({ title: "账本加载失败", icon: "none" }); } finally { this.setData({ loading: false }); }
  },
  editLedger() { wx.showToast({ title: "编辑账本入口已预留", icon: "none" }); },
  manageMembers() { wx.showToast({ title: "成员管理入口已预留", icon: "none" }); },
  async inviteLedger() {
    const ledger = this.data.ledger; if (!ledger || !ledger.isOwner) return;
    wx.showLoading({ title: "准备分享" });
    try {
      const shareOptions = await Promise.all(getShareOptions(ledger).map(async (item) => {
        const result = await this.callApi("createLedgerInviteToken", { ledgerId: ledger.id, mode: item.mode });
        if (!result || !result.success || !result.data || !result.data.token) throw new Error((result && result.message) || "分享准备失败");
        return { ...item, inviteToken: result.data.token };
      }));
      this.setData({ shareSheetVisible: true, shareOptions, shareMode: shareOptions[0].mode });
    } catch (error) { wx.showToast({ title: error.message || "分享准备失败", icon: "none" }); } finally { wx.hideLoading(); }
  },
  closeShareSheet() { this.setData({ shareSheetVisible: false }); }, stopSheetTap() {}, selectShareMode(e) { this.setData({ shareMode: e.currentTarget.dataset.mode || "visitor" }); },
  onShareAppMessage(options = {}) {
    const ledger = this.data.ledger || {}; const mode = ledger.type === "personal" ? "visitor" : ((options.target && options.target.dataset.mode) || this.data.shareMode);
    const option = this.data.shareOptions.find((item) => item.mode === mode) || this.data.shareOptions[0] || {};
    return { title: mode === "visitor" ? `邀请你查看「${ledger.displayName}」` : `邀请你加入「${ledger.displayName}」`, path: `/pages/ledger-join-result/index?inviteToken=${encodeURIComponent(option.inviteToken || "")}` };
  },
  deleteLedger() {
    const ledger = this.data.ledger; if (!ledger || !ledger.isOwner || this.data.deleting) return;
    wx.showModal({ title: "删除账本", content: `确定删除「${ledger.displayName}」吗？删除后账本记录也会一并移除。`, confirmText: "删除", confirmColor: "#d9483b", success: async (res) => {
      if (!res.confirm) return; this.setData({ deleting: true }); wx.showLoading({ title: "删除中" });
      try { const result = await this.callApi("deleteLedger", { ledgerId: ledger.id }); if (!result || !result.success) { wx.showToast({ title: (result && result.message) || "删除失败", icon: "none" }); return; }
        if (app.globalData.user) app.globalData.user.currentLedgerId = (result.data && result.data.currentLedgerId) || ""; app.globalData.currentLedger = (result.data && result.data.currentLedger) || null; app.persistAuthState(); wx.showToast({ title: "已删除", icon: "success" }); setTimeout(() => wx.navigateBack(), 450);
      } catch (error) { wx.showToast({ title: "删除失败", icon: "none" }); } finally { wx.hideLoading(); this.setData({ deleting: false }); }
    }});
  },
});
