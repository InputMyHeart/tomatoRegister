const app = getApp();
const feedback = require("../../services/feedback-ui");
const { getId } = require("../../utils/mapper");
const categoryService = require("../../services/category.service");
const categoryStore = require("../../services/category.store");
const { startNavigation, markNavigation } = require("../../utils/navigation-timing");
function toGroups(categories, type) {
  const parents = categories.filter((item) => item.type === type && item.level === "parent");
  const children = categories.filter((item) => item.type === type && item.level === "child");
  return parents.map((parent) => ({
    ...parent,
    id: getId(parent),
    children: children
      .filter((child) => child.parentId === parent._id)
      .map((child) => ({ ...child, label: child.name })),
  }));
}
Page({
  data: {
    type: "expense",
    groups: [],
    expandedGroupId: "",
    ledgerId: "",
    mode: "create",
    ledgerName: "选择分类",
  },
  onLoad(options = {}) {
    markNavigation("分类页", "onLoad");
    const ledger = app.globalData.currentLedger || {};
    this.setData({
      type: options.type === "income" ? "income" : "expense",
      ledgerId: options.ledgerId || ledger._id || "",
      mode: options.mode === "reselect" ? "reselect" : "create",
      ledgerName: options.ledgerName
        ? decodeURIComponent(options.ledgerName)
        : ledger.name || "选择分类",
    });
  },
  onReady() {
    markNavigation("分类页", "onReady");
  },
  onShow() {
    this.renderFromCache();
    this._unsubscribe = categoryStore.subscribeSync((result) => {
      if (result.ledgerId !== this.data.ledgerId) return;
      if (result.invalidated) this.loadCategories();
      else this.renderCategories(result.items);
    });
    this.loadCategories();
  },
  onHide() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  },
  onUnload() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  },
  renderFromCache() {
    const cached = categoryStore.getCategoriesSync(this.data.ledgerId);
    this.renderCategories(cached);
  },
  renderCategories(categories) {
    const groups = toGroups(categories || [], this.data.type);
    this.setData({
      groups,
      expandedGroupId: groups[0] ? groups[0].id : this.data.expandedGroupId,
    });
  },
  async loadCategories() {
    try {
      const items = await categoryService.listCategories(this.data.ledgerId);
      this.renderCategories(items);
    } catch (error) {
      feedback.showToast({ type: "error", message: error.message || "分类加载失败，请重试" });
    }
  },
  switchType(event) {
    this.setData({ type: event.currentTarget.dataset.type });
    this.renderFromCache();
  },
  toggleGroup(event) {
    const id = event.detail.id || event.currentTarget.dataset.id;
    this.setData({ expandedGroupId: this.data.expandedGroupId === id ? "" : id });
  },
  openCategoryManager() {
    const params = [
      `ledgerId=${encodeURIComponent(this.data.ledgerId)}`,
      `type=${this.data.type}`,
      `ledgerName=${encodeURIComponent(this.data.ledgerName)}`,
    ];
    wx.navigateTo({ url: `/pages/category-manage/index?${params.join("&")}` });
  },
  chooseCategory(event) {
    const { category, categoryLabel, categoryIcon, parent, parentIcon } = event.detail.category
      ? event.detail
      : event.currentTarget.dataset;
    if (this.data.mode === "reselect") {
      const previous = getCurrentPages().slice(-2)[0];
      if (previous && previous.applyCategorySelection)
        previous.applyCategorySelection({
          type: this.data.type,
          categoryName: category,
          categoryLabel,
          categoryIcon,
          parentCategory: parent,
          parentIcon,
        });
      wx.navigateBack();
      return;
    }
    const params = [
      `type=${this.data.type}`,
      `category=${encodeURIComponent(category)}`,
      `categoryLabel=${encodeURIComponent(categoryLabel)}`,
      `categoryIcon=${encodeURIComponent(categoryIcon)}`,
      `parentCategory=${encodeURIComponent(parent)}`,
      `parentIcon=${encodeURIComponent(parentIcon)}`,
      this.data.ledgerId ? `ledgerId=${encodeURIComponent(this.data.ledgerId)}` : "",
    ];
    startNavigation("分类页", "编辑页");
    wx.redirectTo({ url: `/pages/record-edit/index?${params.filter(Boolean).join("&")}` });
  },
});
