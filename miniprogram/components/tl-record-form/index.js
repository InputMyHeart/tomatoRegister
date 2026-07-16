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
  },
  methods: {
    amountInput(event) {
      this.triggerEvent("amountinput", event.detail);
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
    submit() {
      this.triggerEvent("submit");
    },
  },
});
