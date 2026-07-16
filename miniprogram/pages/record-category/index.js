const app = getApp();
const { getId } = require("../../utils/mapper");
const categoryService = require("../../services/category.service");
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
    const ledger = app.globalData.currentLedger || {};
    this.setData({
      type: options.type === "income" ? "income" : "expense",
      ledgerId: options.ledgerId || ledger._id || "",
      mode: options.mode === "reselect" ? "reselect" : "create",
      ledgerName: options.ledgerName
        ? decodeURIComponent(options.ledgerName)
        : ledger.name || "选择分类",
    });
    this.loadCategories();
  },
  async loadCategories() {
    const data = await categoryService.listCategories(this.data.ledgerId);
    const groups = toGroups(data.categories || [], this.data.type);
    this.setData({ groups, expandedGroupId: groups[0] ? groups[0].id : "" });
  },
  switchType(event) {
    this.setData({ type: event.currentTarget.dataset.type });
    this.loadCategories();
  },
  toggleGroup(event) {
    const id = event.detail.id || event.currentTarget.dataset.id;
    this.setData({ expandedGroupId: this.data.expandedGroupId === id ? "" : id });
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
    wx.redirectTo({ url: `/pages/record-edit/index?${params.filter(Boolean).join("&")}` });
  },
});
