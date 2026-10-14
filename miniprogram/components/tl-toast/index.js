const ICON_NAMES = {
  success: "checkbox-circle-line",
  warning: "error-warning-line",
  error: "close-circle-line",
  info: "information-line",
};

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    type: {
      type: String,
      value: "info",
    },
    message: {
      type: String,
      value: "",
    },
  },

  data: {
    iconName: ICON_NAMES.info,
  },

  observers: {
    type(type) {
      this.setData({ iconName: ICON_NAMES[type] || ICON_NAMES.info });
    },
  },
});
