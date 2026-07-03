Component({
  properties: {
    readonly: {
      type: Boolean,
      value: false,
    },
    ledgerId: {
      type: String,
      value: "",
    },
    defaultType: {
      type: String,
      value: "expense",
    },
    defaultCategory: {
      type: String,
      value: "",
    },
  },

  methods: {
    handleTap() {
      if (this.data.readonly) return;
      const params = [];
      if (this.data.ledgerId) params.push(`ledgerId=${this.data.ledgerId}`);
      if (this.data.defaultType) params.push(`type=${this.data.defaultType}`);
      if (this.data.defaultCategory) params.push(`category=${this.data.defaultCategory}`);
      const query = params.length ? `?${params.join("&")}` : "";
      wx.navigateTo({ url: `/pages/record-edit/index${query}` });
    },
  },
});
