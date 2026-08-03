const app = getApp();
const ledgerService = require("../../services/ledger.service");
const ledgerStore = require("../../services/ledger.store");
const { getPaymentAccounts } = require("../../services/payment-account.service");

Page({
  data: {
    ledgerId: "",
    ledgerName: "我的账本",
    accounts: [],
    readonly: false,
    saving: false,
  },
  onShow() {
    this.loadCurrentLedger();
  },
  async loadCurrentLedger() {
    if (this.loading) return;
    this.loading = true;
    try {
      const auth = await app.loginWithWechat({ force: true });
      const ledger = auth.currentLedger || {};
      this.setData({
        ledgerId: ledger._id || "",
        ledgerName: ledger.name || "我的账本",
        accounts: getPaymentAccounts(ledger),
        readonly: Boolean(ledger.readonly),
      });
    } catch (error) {
      wx.showToast({ title: error.message || "账户加载失败", icon: "none" });
    } finally {
      this.loading = false;
    }
  },
  async saveAccounts(accounts) {
    if (this.data.saving) return false;
    this.setData({ saving: true });
    try {
      const data = await ledgerService.updateAccounts({
        ledgerId: this.data.ledgerId,
        accounts,
      });
      app.globalData.currentLedger = {
        ...(app.globalData.currentLedger || {}),
        ...(data.ledger || {}),
      };
      app.persistAuthState();
      await ledgerStore.refreshLedgers();
      this.setData({ accounts });
      return true;
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
      return false;
    } finally {
      this.setData({ saving: false });
    }
  },
  async removeAccount(event) {
    if (this.data.readonly || this.data.saving) return;
    const index = Number(event.currentTarget.dataset.index);
    const account = this.data.accounts[index];
    if (!account) return;
    if (this.data.accounts.length <= 1) {
      wx.showToast({ title: "请至少保留一个账户", icon: "none" });
      return;
    }
    const result = await new Promise((resolve) => {
      wx.showModal({
        title: "删除账户",
        content: `删除“${account}”后，已有记录仍会保留该账户名称。`,
        confirmText: "删除",
        confirmColor: "#f0442f",
        success: (res) => resolve(Boolean(res.confirm)),
        fail: () => resolve(false),
      });
    });
    if (result)
      await this.saveAccounts(this.data.accounts.filter((_, itemIndex) => itemIndex !== index));
  },
  addAccount() {
    if (this.data.readonly || this.data.saving) return;
    wx.showModal({
      title: "新增账户",
      editable: true,
      placeholderText: "例如：招商银行信用卡",
      success: async (res) => {
        if (!res.confirm) return;
        const name = String(res.content || "").trim();
        if (!name) return wx.showToast({ title: "请输入账户名称", icon: "none" });
        if (Array.from(name).length > 12)
          return wx.showToast({ title: "账户名称最多 12 个字符", icon: "none" });
        if (this.data.accounts.includes(name))
          return wx.showToast({ title: "该账户已存在", icon: "none" });
        await this.saveAccounts([...this.data.accounts, name]);
      },
    });
  },
});
