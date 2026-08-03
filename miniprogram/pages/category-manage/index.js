const app = getApp();
const categoryService = require("../../services/category.service");
function groupCategories(categories, type) {
  const children = categories.filter((item) => item.type === type && item.level === "child");
  return categories
    .filter((item) => item.type === type && item.level === "parent")
    .map((parent) => ({
      ...parent,
      children: children.filter((child) => child.parentId === parent._id),
    }));
}
function buildRows(groups, activeParentId, canCreate) {
  const allItems = canCreate
    ? [...groups, { _id: "__parent_manager__", isManager: true, name: "管理" }]
    : groups;
  const rows = [];
  for (let index = 0; index < allItems.length; index += 4) {
    const items = allItems.slice(index, index + 4);
    rows.push({
      id: items.map((item) => item._id).join("_"),
      items,
      isActive: items.some((item) => item._id === activeParentId),
    });
  }
  return rows;
}
Page({
  data: {
    ledgerId: "",
    ledgerName: "分类管理",
    role: "",
    pageIndex: 0,
    type: "expense",
    expenseGroups: [],
    incomeGroups: [],
    expenseRows: [],
    incomeRows: [],
    currentRows: [],
    activeParentId: "",
    activeParentName: "",
    activeChildren: [],
    canCreate: false,
  },
  onLoad(options = {}) {
    const ledger = app.globalData.currentLedger || {};
    const ledgerId = options.ledgerId || ledger._id || "";
    const type = options.type === "income" ? "income" : "expense";
    this.setData({
      ledgerId,
      ledgerName: options.ledgerName
        ? decodeURIComponent(options.ledgerName)
        : ledger.name || "分类管理",
      type,
      pageIndex: type === "income" ? 1 : 0,
    });
  },
  onShow() {
    this.loadCategories();
  },
  async loadCategories() {
    const ledger = app.globalData.currentLedger || {};
    const ledgerId = this.data.ledgerId || ledger._id;
    if (!ledgerId) return;
    const data = await categoryService.listCategories(ledgerId);
    const categories = data.categories || [];
    const expenseGroups = groupCategories(categories, "expense");
    const incomeGroups = groupCategories(categories, "income");
    const type = this.data.type;
    const groups = type === "income" ? incomeGroups : expenseGroups;
    const activeParentId = groups.some((item) => item._id === this.data.activeParentId)
      ? this.data.activeParentId
      : (groups[0] && groups[0]._id) || "";
    const role = data.role || "";
    const canCreate = ["owner", "member"].includes(role);
    const expenseRows = buildRows(expenseGroups, activeParentId, canCreate);
    const incomeRows = buildRows(incomeGroups, activeParentId, canCreate);
    this.setData({
      ledgerId,
      role,
      expenseGroups,
      incomeGroups,
      expenseRows,
      incomeRows,
      currentRows: type === "income" ? incomeRows : expenseRows,
      activeParentId,
      activeParentName: this.findParentName(activeParentId, expenseGroups, incomeGroups),
      activeChildren: this.findChildren(activeParentId, expenseGroups, incomeGroups),
      canCreate,
    });
  },
  findParent(id, expenseGroups = this.data.expenseGroups, incomeGroups = this.data.incomeGroups) {
    return [...expenseGroups, ...incomeGroups].find((item) => item._id === id);
  },
  findChildren(id, expenseGroups = this.data.expenseGroups, incomeGroups = this.data.incomeGroups) {
    const parent = this.findParent(id, expenseGroups, incomeGroups);
    return parent ? parent.children : [];
  },
  findParentName(
    id,
    expenseGroups = this.data.expenseGroups,
    incomeGroups = this.data.incomeGroups
  ) {
    const parent = this.findParent(id, expenseGroups, incomeGroups);
    return parent ? parent.name : "";
  },
  changePage(event) {
    const pageIndex = Number(event.currentTarget.dataset.index || 0);
    const type = pageIndex ? "income" : "expense";
    const groups = pageIndex ? this.data.incomeGroups : this.data.expenseGroups;
    const activeParentId = (groups[0] && groups[0]._id) || "";
    const currentRows = buildRows(groups, activeParentId, this.data.canCreate);
    this.setData({
      pageIndex,
      type,
      activeParentId,
      activeParentName: this.findParentName(activeParentId),
      activeChildren: this.findChildren(activeParentId),
      currentRows,
    });
  },
  selectParent(event) {
    const activeParentId = event.currentTarget.dataset.id;
    const groups = this.data.type === "income" ? this.data.incomeGroups : this.data.expenseGroups;
    this.setData({
      activeParentId,
      activeParentName: this.findParentName(activeParentId),
      activeChildren: this.findChildren(activeParentId),
      currentRows: buildRows(groups, activeParentId, this.data.canCreate),
    });
  },
  openManager(event) {
    const level = event.currentTarget.dataset.level;
    const parentId = event.currentTarget.dataset.parentId || "";
    wx.navigateTo({
      url: `/pages/category-operation/index?ledgerId=${encodeURIComponent(this.data.ledgerId)}&type=${this.data.type}&level=${level}&parentId=${encodeURIComponent(parentId)}`,
    });
  },
});
