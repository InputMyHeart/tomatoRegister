const feedback = require("../../services/feedback-ui");
const app = getApp();
const { startNavigation } = require("../../utils/navigation-timing");

const leftTabs = [
  {
    key: "index",
    text: "首页",
    icon: "home-5-line",
    activeIcon: "home-5-fill",
  },
  {
    key: "records",
    text: "明细",
    icon: "file-list-3-line",
    activeIcon: "file-list-3-fill",
  },
];

const rightTabs = [
  {
    key: "analysis",
    text: "分析",
    icon: "pie-chart-2-line",
    activeIcon: "pie-chart-2-fill",
  },
  {
    key: "profile",
    text: "我的",
    icon: "user-3-line",
    activeIcon: "user-3-fill",
  },
];

Component({
  properties: {
    active: {
      type: String,
      value: "index",
    },
    readonly: {
      type: Boolean,
      value: false,
    },
    recordDisabledReason: {
      type: String,
      value: "",
    },
  },

  data: {
    leftTabs,
    rightTabs,
    resolvedRecordDisabledReason: "",
  },

  observers: {
    "readonly, recordDisabledReason": function updateRecordDisabled() {
      this.updateRecordDisabledReason();
    },
  },

  lifetimes: {
    attached() {
      this.updateRecordDisabledReason();
    },
  },

  methods: {
    switchTab(e) {
      const { key } = e.currentTarget.dataset;
      if (!key || key === this.data.active) return;
      this.triggerEvent("change", { key });
    },

    getRecordDisabledReason() {
      if (this.data.recordDisabledReason) return this.data.recordDisabledReason;
      if (this.data.readonly) return "readonly";
      const currentLedger = app.globalData && app.globalData.currentLedger;
      if (!currentLedger || !currentLedger._id) return "noLedger";
      if (currentLedger.readonly || currentLedger.role === "readonly") return "readonly";
      return "";
    },

    updateRecordDisabledReason() {
      const reason = this.getRecordDisabledReason();
      if (reason !== this.data.resolvedRecordDisabledReason) {
        this.setData({ resolvedRecordDisabledReason: reason });
      }
    },

    handleRecord() {
      const reason = this.getRecordDisabledReason();
      if (reason === "noLedger") {
        feedback.showToast({
          type: "warning",
          message: "\u6682\u65e0\u53ef\u7528\u7684\u8d26\u672c",
        });
        this.updateRecordDisabledReason();
        return;
      }
      if (reason === "readonly") {
        feedback.showReadonlyToast();
        this.updateRecordDisabledReason();
        return;
      }
      if (reason) {
        feedback.showToast({ type: "warning", message: "\u8bf7\u7a0d\u540e\u518d\u8bd5" });
        this.updateRecordDisabledReason();
        return;
      }
      startNavigation("首页", "分类页");
      wx.navigateTo({ url: "/pages/record-category/index" });
    },
  },
});
