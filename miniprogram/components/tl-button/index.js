Component({
  properties: {
    variant: {
      type: String,
      value: "primary",
    },
    size: {
      type: String,
      value: "medium",
    },
    block: {
      type: Boolean,
      value: false,
    },
    loading: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    loadingText: {
      type: String,
      value: "处理中...",
    },
  },

  methods: {
    handleTap() {
      if (this.data.disabled || this.data.loading) return;
      this.triggerEvent("tap");
    },
  },
});
