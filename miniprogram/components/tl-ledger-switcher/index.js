Component({
  properties: {
    visible: { type: Boolean, value: false },
    ledgers: { type: Array, value: [] },
    selectedId: { type: String, value: "" },
    selectedText: { type: String, value: "查看中" },
    title: { type: String, value: "切换账本" },
    subtitle: { type: String, value: "仅切换数据，不会激活账本" },
    loading: { type: Boolean, value: false },
    error: { type: Boolean, value: false },
    busy: { type: Boolean, value: false },
    showActions: { type: Boolean, value: false },
  },
  data: { options: [] },
  observers: {
    "ledgers, selectedId"(ledgers, selectedId) {
      this.setData({
        options: (ledgers || []).map((ledger) => {
          const id = ledger._id || ledger.id || "";
          return {
            id,
            name: ledger.name || ledger.displayName || "未命名账本",
            icon: ledger.icon || "book-2-line",
            typeText: ledger.type === "shared" ? "共享账本" : "个人账本",
            meta: ledger.roleTag ? `${ledger.roleTag} · ${Number(ledger.memberCount || 0)} 人` : "",
            selected: id === selectedId,
          };
        }),
      });
    },
  },
  methods: {
    close() {
      if (!this.data.busy) this.triggerEvent("close");
    },
    select(event) {
      if (this.data.busy || this.data.loading || this.data.error) return;
      this.triggerEvent("select", { ledgerId: event.currentTarget.dataset.id });
    },
    retry() {
      if (!this.data.busy && !this.data.loading) this.triggerEvent("retry");
    },
    manage() {
      if (!this.data.busy) this.triggerEvent("manage");
    },
    create() {
      if (!this.data.busy) this.triggerEvent("create");
    },
  },
});
