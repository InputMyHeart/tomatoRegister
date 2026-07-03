Component({
  properties: {
    title: {
      type: String,
      value: "首页",
    },
    showBack: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    statusBarHeight: 24,
    navHeight: 48,
  },

  lifetimes: {
    attached() {
      const info = wx.getSystemInfoSync();
      const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
      const statusBarHeight = info.statusBarHeight || 24;
      const navHeight = menu ? menu.bottom + menu.top - statusBarHeight * 2 : 48;
      this.setData({ statusBarHeight, navHeight });
    },
  },

  methods: {
    handleBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
        return;
      }
      wx.switchTab({ url: "/pages/index/index" });
    },
  },
});