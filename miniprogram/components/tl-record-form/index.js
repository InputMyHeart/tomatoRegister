const {
  evaluateAmountExpression,
  getAmountValidationMessage,
  limitAmountPrecision,
} = require("../../utils/amount-expression");

Component({
  properties: {
    amount: { type: String, value: "" },
    type: { type: String, value: "expense" },
    amountResult: { type: String, value: "" },
    showAmountResult: { type: Boolean, value: false },
    quickAmounts: { type: Array, value: [] },
    ledgerName: { type: String, value: "" },
    accounts: { type: Array, value: [] },
    accountIndex: { type: Number, value: 0 },
    date: { type: String, value: "" },
    note: { type: String, value: "" },
    tagInput: { type: String, value: "" },
    tags: { type: Array, value: [] },
    canSave: { type: Boolean, value: false },
    saving: { type: Boolean, value: false },
    isEditing: { type: Boolean, value: false },
    deleting: { type: Boolean, value: false },
  },
  data: {
    showKeypad: false,
  },
  methods: {
    openKeypad() {
      this.setData({ showKeypad: true });
    },
    closeKeypad() {
      this.settleAmount(false);
      this.setData({ showKeypad: false });
    },
    updateAmount(value) {
      this.triggerEvent("amountinput", { value: limitAmountPrecision(value) });
    },
    pressNumber(event) {
      const digit = String(event.currentTarget.dataset.digit);
      const amount = String(this.data.amount || "");
      const next = /(^|[+-])0$/.test(amount)
        ? `${amount.slice(0, -1)}${digit}`
        : `${amount}${digit}`;
      this.updateAmount(next);
    },
    pressDecimal() {
      const amount = String(this.data.amount || "");
      const currentPart = amount.split(/[+-]/).pop() || "";
      if (currentPart.includes(".")) return;
      this.updateAmount(`${amount}${currentPart ? "." : "0."}`);
    },
    pressOperator(event) {
      const operator = event.currentTarget.dataset.operator;
      const amount = String(this.data.amount || "");
      if (!amount) {
        if (operator === "-") this.updateAmount("0-");
        return;
      }
      if (/[+-]$/.test(amount)) {
        this.updateAmount(`${amount.slice(0, -1)}${operator}`);
        return;
      }
      this.updateAmount(`${amount}${operator}`);
    },
    backspace() {
      this.updateAmount(String(this.data.amount || "").slice(0, -1));
    },
    clearAmount() {
      this.updateAmount("");
    },
    settleAmount(showInvalidPrompt) {
      const result = evaluateAmountExpression(this.data.amount);
      if (result.valid) {
        this.updateAmount(result.text);
        return true;
      }
      if (result.text || showInvalidPrompt) {
        wx.showToast({
          title: getAmountValidationMessage(this.data.type, result),
          icon: "none",
        });
      }
      return false;
    },
    calculate() {
      this.settleAmount(true);
    },
    quickAmount(event) {
      this.triggerEvent("quickamount", { amount: event.currentTarget.dataset.amount });
    },
    accountChange(event) {
      this.triggerEvent("accountchange", event.detail);
    },
    dateChange(event) {
      this.triggerEvent("datechange", event.detail);
    },
    noteInput(event) {
      this.triggerEvent("noteinput", event.detail);
    },
    tagInput(event) {
      this.triggerEvent("taginput", event.detail);
    },
    addTag() {
      this.triggerEvent("addtag");
    },
    removeTag(event) {
      this.triggerEvent("removetag", { index: event.currentTarget.dataset.index });
    },
    deleteRecord() {
      this.triggerEvent("delete");
    },
    submit() {
      this.triggerEvent("submit");
    },
  },
});
