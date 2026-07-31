Component({
  properties: {
    amount: { type: String, value: "" },
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
  methods: {
    amountInput(event) {
      const value = String(event.detail.value || "").replace(/(\.\d{2})\d+/g, "$1");
      this.setData({ amount: value });
      this.triggerEvent("amountinput", { ...event.detail, value });
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
