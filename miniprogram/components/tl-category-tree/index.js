Component({
  properties: {
    groups: { type: Array, value: [] },
    expandedGroupId: { type: String, value: "" },
  },
  methods: {
    toggle(event) {
      this.triggerEvent("toggle", { id: event.currentTarget.dataset.id });
    },
    select(event) {
      this.triggerEvent("select", event.currentTarget.dataset);
    },
  },
});
