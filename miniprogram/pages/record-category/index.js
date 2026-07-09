const app = getApp();

const iconMap = {
  expense: "price-tag-3-line",
  income: "funds-line",
  food: "restaurant-2-line",
  shopping: "bank-card-line",
  transport: "switch-line",
  home: "settings-3-line",
  family: "group-line",
  life: "book-2-line",
  work: "wallet-3-line",
  side: "file-list-3-line",
  asset: "funds-line",
  other: "price-tag-3-line",
};

const categoryGroups = {
  expense: [
    {
      id: "food",
      name: "餐饮",
      icon: iconMap.food,
      children: [
        { name: "早餐", label: "早餐", icon: "restaurant-2-line" },
        { name: "午餐", label: "午餐", icon: "restaurant-2-line" },
        { name: "晚餐", label: "晚餐", icon: "restaurant-2-line" },
        { name: "买菜", label: "买菜", icon: "bank-card-line" },
        { name: "水果零食", label: "零食", icon: "price-tag-3-line" },
        { name: "咖啡奶茶", label: "饮品", icon: "restaurant-2-line" },
        { name: "聚餐", label: "聚餐", icon: "group-line" },
      ],
    },
    {
      id: "shopping",
      name: "购物",
      icon: iconMap.shopping,
      children: [
        { name: "日用品", label: "日用", icon: "price-tag-3-line" },
        { name: "服饰鞋包", label: "服饰", icon: "price-tag-3-line" },
        { name: "数码电器", label: "数码", icon: "settings-3-line" },
        { name: "美妆个护", label: "个护", icon: "eye-line" },
        { name: "家居用品", label: "家居", icon: "settings-3-line" },
      ],
    },
    {
      id: "transport",
      name: "交通",
      icon: iconMap.transport,
      children: [
        { name: "地铁公交", label: "公交", icon: "switch-line" },
        { name: "打车", label: "打车", icon: "switch-line" },
        { name: "加油充电", label: "能源", icon: "funds-line" },
        { name: "停车", label: "停车", icon: "calendar-check-line" },
        { name: "火车机票", label: "长途", icon: "upload-2-line" },
      ],
    },
    {
      id: "home",
      name: "居家",
      icon: iconMap.home,
      children: [
        { name: "房租房贷", label: "住房", icon: "key-2-line" },
        { name: "水电燃气", label: "水电", icon: "settings-3-line" },
        { name: "物业", label: "物业", icon: "file-list-3-line" },
        { name: "维修", label: "维修", icon: "settings-3-line" },
        { name: "宽带通讯", label: "通讯", icon: "message-3-line" },
      ],
    },
    {
      id: "family",
      name: "家庭",
      icon: iconMap.family,
      children: [
        { name: "育儿", label: "育儿", icon: "group-line" },
        { name: "宠物", label: "宠物", icon: "eye-line" },
        { name: "医疗", label: "医疗", icon: "file-list-3-line" },
        { name: "人情", label: "人情", icon: "group-line" },
        { name: "父母家人", label: "家人", icon: "group-line" },
      ],
    },
    {
      id: "life",
      name: "生活",
      icon: iconMap.life,
      children: [
        { name: "学习", label: "学习", icon: "book-2-line" },
        { name: "娱乐", label: "娱乐", icon: "eye-line" },
        { name: "运动", label: "运动", icon: "history-line" },
        { name: "旅行", label: "旅行", icon: "upload-2-line" },
        { name: "其他支出", label: "其他", icon: "price-tag-3-line" },
      ],
    },
  ],
  income: [
    {
      id: "work",
      name: "工作收入",
      icon: iconMap.work,
      children: [
        { name: "工资", label: "工资", icon: "wallet-3-line" },
        { name: "奖金", label: "奖金", icon: "funds-line" },
        { name: "加班", label: "加班", icon: "history-line" },
        { name: "报销", label: "报销", icon: "file-list-3-line" },
      ],
    },
    {
      id: "side",
      name: "副业收入",
      icon: iconMap.side,
      children: [
        { name: "副业", label: "副业", icon: "file-list-3-line" },
        { name: "项目", label: "项目", icon: "file-list-3-line" },
        { name: "稿费", label: "稿费", icon: "book-2-line" },
        { name: "咨询", label: "咨询", icon: "message-3-line" },
      ],
    },
    {
      id: "asset",
      name: "资产收入",
      icon: iconMap.asset,
      children: [
        { name: "理财", label: "理财", icon: "funds-line" },
        { name: "利息", label: "利息", icon: "funds-line" },
        { name: "分红", label: "分红", icon: "wallet-3-line" },
        { name: "房租", label: "房租", icon: "key-2-line" },
      ],
    },
    {
      id: "other",
      name: "其他收入",
      icon: iconMap.other,
      children: [
        { name: "红包", label: "红包", icon: "download-2-line" },
        { name: "退款", label: "退款", icon: "logout-box-r-line" },
        { name: "礼金", label: "礼金", icon: "funds-line" },
        { name: "其他收入", label: "其他", icon: "price-tag-3-line" },
      ],
    },
  ],
};

function groupsFor(type) {
  return categoryGroups[type] || categoryGroups.expense;
}

Page({
  data: {
    type: "expense",
    groups: groupsFor("expense"),
    expandedGroupId: "food",
    ledgerId: "",
    mode: "create",
    ledgerName: "选择分类",
  },

  onLoad(options = {}) {
    const type = options.type === "income" ? "income" : "expense";
    const groups = groupsFor(type);
    const currentLedger = app.globalData.currentLedger || {};
    this.setData({
      type,
      groups,
      ledgerId: options.ledgerId || "",
      mode: options.mode === "reselect" ? "reselect" : "create",
      ledgerName: options.ledgerName ? decodeURIComponent(options.ledgerName) : (currentLedger.name || "选择分类"),
      expandedGroupId: groups[0] ? groups[0].id : "",
    });
  },

  switchType(event) {
    const type = event.currentTarget.dataset.type;
    const groups = groupsFor(type);
    this.setData({
      type,
      groups,
      expandedGroupId: groups[0] ? groups[0].id : "",
    });
  },

  toggleGroup(event) {
    const groupId = event.currentTarget.dataset.id;
    this.setData({ expandedGroupId: this.data.expandedGroupId === groupId ? "" : groupId });
  },

  chooseCategory(event) {
    const { category, categoryLabel, categoryIcon, parent, parentIcon } = event.currentTarget.dataset;
    if (this.data.mode === "reselect") {
      const pages = getCurrentPages();
      const previousPage = pages[pages.length - 2];
      if (previousPage && previousPage.applyCategorySelection) {
        previousPage.applyCategorySelection({
          type: this.data.type,
          categoryName: category,
          categoryLabel,
          categoryIcon,
          parentCategory: parent,
          parentIcon,
        });
      }
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
