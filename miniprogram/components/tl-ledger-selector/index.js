Component({
  properties: {
    ledgers: {
      type: Array,
      value: [],
    },
    currentId: {
      type: String,
      value: "",
    },
  },
  methods: {
    select(event) {
      this.triggerEvent("select", { ledgerId: event.currentTarget.dataset.id });
    },
  },
});
