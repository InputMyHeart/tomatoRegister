const feedback = require("../../services/feedback-ui");
const app = getApp();
const ledgerStore = require("../../services/ledger.store");
const DEFAULT_AMOUNTS = [18, 32, 68, 128];

function cleanAmount(value) {
  return String(value || "")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1")
    .slice(0, 9);
}
function validAmount(value) {
  return /^\d+(?:\.\d{1,2})?$/.test(String(value)) && Number(value) > 0 && Number(value) <= 999999;
}

Page({
  data: {
    ledgerId: "",
    ledgerName: "我的账本",
    quickAmountsEnabled: false,
    amounts: [],
    inputAmount: "",
    saving: false,
    readonly: false,
  },
  onShow() {
    this.loadCurrentLedger();
  },
  async loadCurrentLedger() {
    if (this.loadingLedger) return;
    this.loadingLedger = true;
    try {
      const auth = await app.loginWithWechat({ force: true });
      const ledger = auth.currentLedger || {};
      this.setData({
        ledgerId: ledger._id || "",
        ledgerName: ledger.name || "我的账本",
        quickAmountsEnabled: Boolean(ledger.quickAmountsEnabled),
        amounts: Array.isArray(ledger.quickAmounts) ? ledger.quickAmounts.map(String) : [],
        readonly: Boolean(ledger.readonly),
      });
    } catch (error) {
      feedback.showToast({ type: "error", message: error.message || "账本加载失败" });
    } finally {
      this.loadingLedger = false;
    }
  },
  onEnableChange(event) {
    this.setData({ quickAmountsEnabled: Boolean(event.detail.value) });
  },
  onAmountInput(event) {
    this.setData({ inputAmount: cleanAmount(event.detail.value) });
  },
  addAmount() {
    if (this.data.amounts.length >= 5)
      return feedback.showToast({ type: "warning", message: "最多添加 5 个金额" });
    const value = this.data.inputAmount;
    if (!validAmount(value))
      return feedback.showToast({ type: "warning", message: "请输入 0.01-999999 的金额" });
    this.setData({ amounts: [...this.data.amounts, String(Number(value))], inputAmount: "" });
  },
  removeAmount(event) {
    this.setData({
      amounts: this.data.amounts.filter(
        (_, index) => index !== Number(event.currentTarget.dataset.index)
      ),
    });
  },
  async save() {
    if (this.data.readonly)
      return feedback.showToast({ type: "warning", message: "访客不能设置快捷金额" });
    if (this.data.saving) return;
    const amounts = this.data.amounts.map(Number);
    if (
      this.data.quickAmountsEnabled &&
      (!amounts.length || amounts.some((value) => !validAmount(value)))
    )
      return feedback.showToast({ type: "warning", message: "请设置 1-5 个有效金额" });
    this.setData({ saving: true });
    try {
      const data = await ledgerStore.updateQuickAmounts({
        ledgerId: this.data.ledgerId,
        quickAmountsEnabled: this.data.quickAmountsEnabled,
        quickAmounts: amounts,
      });
      app.globalData.currentLedger = {
        ...(app.globalData.currentLedger || {}),
        ...(data.ledger || {}),
      };
      app.persistAuthState();
      feedback.showToast({ type: "success", message: "已保存" });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (error) {
      feedback.showToast({ type: "error", message: error.message || "保存失败" });
    } finally {
      this.setData({ saving: false });
    }
  },
  useDefaults() {
    this.setData({ amounts: DEFAULT_AMOUNTS.map(String) });
  },
});
