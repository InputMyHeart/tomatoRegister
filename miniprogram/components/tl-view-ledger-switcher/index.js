Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    ledgers: {
      type: Array,
      value: [],
    },
    viewingId: {
      type: String,
      value: "",
    },
    title: {
      type: String,
      value: "切换账本",
    },
    loading: {
      type: Boolean,
      value: false,
    },
    error: {
      type: Boolean,
      value: false,
    },
  },
  methods: {
    close() {
      this.triggerEvent("close");
    },
    select(event) {
      this.triggerEvent("select", { ledgerId: event.currentTarget.dataset.id });
    },
    retry() {
      this.triggerEvent("retry");
    },
    stopTap() {},
  },
});
