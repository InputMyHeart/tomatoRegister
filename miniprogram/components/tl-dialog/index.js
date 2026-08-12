Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    closeOnMask: {
      type: Boolean,
      value: true,
    },
  },

  methods: {
    close() {
      if (!this.data.closeOnMask) return;
      this.triggerEvent("close");
    },
    stopTap() {},
  },
});
