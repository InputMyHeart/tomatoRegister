const app = getApp();

const leftTabs = [
  { key: "index", text: "首页", pagePath: "/pages/index/index", icon: "home-5-line", activeIcon: "home-5-fill" },
  { key: "records", text: "明细", pagePath: "/pages/records/index", icon: "file-list-3-line", activeIcon: "file-list-3-fill" },
];

const rightTabs = [
  { key: "analysis", text: "分析", pagePath: "/pages/analysis/index", icon: "pie-chart-2-line", activeIcon: "pie-chart-2-fill" },
  { key: "profile", text: "我的", pagePath: "/pages/profile/index", icon: "user-3-line", activeIcon: "user-3-fill" },
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
      const { key, path } = e.currentTarget.dataset;
      if (!path || key === this.data.active) return;
      wx.redirectTo({ url: path });
    },

    getRecordDisabledReason() {
      if (this.data.recordDisabledReason) return this.data.recordDisabledReason;
      if (this.data.readonly) return "readonly";
      const currentLedger = app.globalData && app.globalData.currentLedger;
      if (!currentLedger || !currentLedger._id) return "noLedger";
      if (currentLedger.readonly) return "readonly";
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
        wx.showToast({ title: "\u6682\u65e0\u53ef\u7528\u7684\u8d26\u672c", icon: "none" });
        this.updateRecordDisabledReason();
        return;
      }
      if (reason === "readonly") {
        wx.showToast({ title: "访客不能记账", icon: "none" });
        this.updateRecordDisabledReason();
        return;
      }
      if (reason) {
        wx.showToast({ title: "\u8bf7\u7a0d\u540e\u518d\u8bd5", icon: "none" });
        this.updateRecordDisabledReason();
        return;
      }
      wx.navigateTo({ url: "/pages/record-category/index" });
    },
  },
});
