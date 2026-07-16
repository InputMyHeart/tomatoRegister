const iconGroups = [
  {
    id: "food",
    label: "餐饮",
    icons: [
      ["restaurant-2-line", "餐厅", "吃饭 餐馆 外卖"],
      ["bowl-line", "餐碗", "吃饭 面食"],
      ["cup-line", "饮品", "奶茶 果汁"],
      ["cake-3-line", "甜点", "蛋糕 烘焙"],
      ["beer-line", "酒水", "啤酒 聚餐"],
      ["goblet-line", "酒杯", "红酒 聚会"],
      ["takeaway-line", "外卖", "配送"],
      ["cake-2-line", "零食", "点心"],
    ],
  },
  {
    id: "shopping",
    label: "购物",
    icons: [
      ["shopping-bag-3-line", "购物袋", "买东西 商场"],
      ["shopping-cart-2-line", "购物车", "网购 超市"],
      ["store-2-line", "商店", "店铺"],
      ["gift-line", "礼物", "送礼 礼金"],
      ["price-tag-3-line", "标签", "商品"],
      ["handbag-line", "手提包", "包包"],
      ["t-shirt-line", "服饰", "衣服 穿搭"],
      ["vip-diamond-line", "会员", "充值"],
      ["coupon-3-line", "优惠券", "折扣"],
    ],
  },
  {
    id: "transport",
    label: "出行",
    icons: [
      ["taxi-line", "打车", "出租车 网约车"],
      ["car-line", "汽车", "开车 车费"],
      ["bus-line", "公交", "巴士"],
      ["subway-line", "地铁", "轨道交通"],
      ["train-line", "火车", "高铁"],
      ["flight-takeoff-line", "飞机", "机票 出差"],
      ["gas-station-line", "加油", "充电 油费"],
      ["parking-line", "停车", "停车费"],
      ["bike-line", "骑行", "共享单车"],
      ["road-map-line", "路线", "导航"],
    ],
  },
  {
    id: "home",
    label: "居家",
    icons: [
      ["home-4-line", "家庭", "家里 住房"],
      ["building-2-line", "房屋", "房租 房贷"],
      ["hotel-bed-line", "床铺", "住宿 酒店"],
      ["lightbulb-line", "水电", "电费"],
      ["fridge-line", "家电", "冰箱 电器"],
      ["tools-line", "维修", "工具 修理"],
      ["sofa-line", "家具", "家居"],
      ["key-2-line", "钥匙", "物业"],
      ["wifi-line", "网络", "宽带"],
      ["recycle-line", "清洁", "环保"],
    ],
  },
  {
    id: "finance",
    label: "账单与资金",
    icons: [
      ["wallet-3-line", "钱包", "余额 支付"],
      ["funds-line", "收支", "收入 支出"],
      ["bank-card-line", "银行卡", "信用卡"],
      ["coins-line", "零钱", "现金 硬币"],
      ["hand-coin-line", "工资", "薪水 报酬"],
      ["money-cny-circle-line", "人民币", "金额"],
      ["briefcase-4-line", "工作", "职业 收入"],
      ["stock-line", "投资", "股票 理财"],
      ["money-dollar-circle-line", "外币", "美元 汇率"],
      ["bill-line", "账单", "对账"],
    ],
  },
  {
    id: "health",
    label: "健康与学习",
    icons: [
      ["heart-pulse-line", "医疗健康", "医院 看病"],
      ["medicine-bottle-line", "药品", "买药"],
      ["hospital-line", "医院", "诊所"],
      ["stethoscope-line", "体检", "医生"],
      ["book-open-line", "阅读", "书籍 买书"],
      ["graduation-cap-line", "教育", "培训 学费"],
      ["pen-nib-line", "学习", "文具"],
      ["scissors-line", "美容", "理发"],
      ["run-line", "运动", "健身"],
      ["mental-health-line", "心理健康", "咨询"],
    ],
  },
  {
    id: "leisure",
    label: "休闲娱乐",
    icons: [
      ["gamepad-line", "游戏", "电玩"],
      ["movie-2-line", "电影", "追剧"],
      ["camera-line", "摄影", "拍照"],
      ["music-2-line", "音乐", "演出"],
      ["football-line", "球类", "体育"],
      ["flight-takeoff-line", "旅行", "旅游"],
      ["palette-line", "艺术", "展览"],
      ["customer-service-line", "服务", "客服"],
      ["group-line", "社交", "聚会"],
      ["bear-smile-line", "宠物", "养宠"],
    ],
  },
  {
    id: "common",
    label: "常用",
    icons: [
      ["more-2-line", "其他", "更多 杂项"],
      ["star-line", "收藏", "喜欢"],
      ["heart-line", "爱心", "心愿"],
      ["calendar-event-line", "日历", "日期"],
      ["map-pin-line", "地点", "位置"],
      ["attachment-line", "附件", "文件"],
      ["bookmark-line", "书签", "标记"],
      ["question-line", "问号", "帮助"],
      ["smartphone-line", "手机", "话费"],
      ["phone-line", "电话", "通讯"],
    ],
  },
].map((group) => ({
  ...group,
  icons: group.icons.map(([name, label, keywords]) => ({
    name,
    label,
    keywords,
    searchText: `${name} ${label} ${keywords}`.toLowerCase(),
  })),
}));

function getVisibleGroups(keyword) {
  const normalizedKeyword = String(keyword || "")
    .trim()
    .toLowerCase();
  return iconGroups
    .map((group) => ({
      ...group,
      icons: normalizedKeyword
        ? group.icons.filter((icon) => icon.searchText.includes(normalizedKeyword))
        : group.icons,
    }))
    .filter((group) => group.icons.length);
}

Page({
  data: {
    selected: "price-tag-3-line",
    keyword: "",
    visibleGroups: iconGroups,
  },

  onLoad(options) {
    this.setData({ selected: options.icon || this.data.selected });
  },

  onKeywordInput(event) {
    const keyword = event.detail.value;
    this.setData({ keyword, visibleGroups: getVisibleGroups(keyword) });
  },

  select(event) {
    const icon = event.currentTarget.dataset.icon;
    const pages = getCurrentPages();
    const previousPage = pages[pages.length - 2];
    if (previousPage && typeof previousPage.onIconSelected === "function") {
      previousPage.onIconSelected(icon);
    }
    wx.navigateBack();
  },
});
