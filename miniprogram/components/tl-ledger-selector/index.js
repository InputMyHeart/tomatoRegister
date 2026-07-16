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
    manage(event) {
      this.triggerEvent("manage", { ledgerId: event.currentTarget.dataset.id });
    },
  },
});
