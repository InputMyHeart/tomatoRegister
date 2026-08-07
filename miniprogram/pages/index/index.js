const app = getApp();

const TAB_TITLES = {
  index: "",
  records: "\u660e\u7ec6",
  analysis: "\u5206\u6790",
  profile: "\u6211\u7684",
};

Page({
  data: {
    activeTab: "index",
    navbarTitle: TAB_TITLES.index,
    recordsMonth: "",
  },

  onLoad(options = {}) {
    const activeTab = TAB_TITLES.hasOwnProperty(options.tab) ? options.tab : "index";
    this.setData({
      activeTab,
      navbarTitle: TAB_TITLES[activeTab],
      recordsMonth: /^\d{4}-\d{2}$/.test(options.month || "") ? options.month : "",
    });
  },

  onShow() {
    if (!app.globalData.recordsNeedRefresh || this.data.activeTab !== "index") return;
    const home = this.selectComponent("#tab-home");
    if (!home || typeof home.refreshDashboard !== "function") return;
    app.globalData.recordsNeedRefresh = false;
    home.refreshDashboard();
  },

  switchTab(event) {
    const tab = event.detail.tab || event.detail.key;
    if (!TAB_TITLES.hasOwnProperty(tab) || tab === this.data.activeTab) return;
    this.setData({
      activeTab: tab,
      navbarTitle: TAB_TITLES[tab],
      recordsMonth: "",
    });
  },
});
