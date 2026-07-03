const app = getApp();

const demoRecords = [
  { id: "1", type: "expense", categoryName: "餐饮", amount: 86.5, note: "周末家庭晚餐", date: "07-01", memberName: "我" },
  { id: "2", type: "income", categoryName: "工资", amount: 12800, note: "月度工资", date: "06-30", memberName: "我" },
  { id: "3", type: "expense", categoryName: "交通", amount: 32, note: "地铁通勤", date: "06-30", memberName: "家人" },
];

Page({
  data: {
    ledgerName: "我家账本",
    monthLabel: "2026 年 7 月",
    roleText: "创建者",
    readonly: false,
    monthIncome: 16800,
    monthExpense: 6240.8,
    balance: 10559.2,
    budget: 9000,
    budgetLeft: 2759.2,
    budgetRate: 69,
    recordCount: 28,
    topCategory: "餐饮",
    familyMood: "这个月节奏不错",
    recentRecords: demoRecords,
  },

  onShow() {
    this.bootstrap();
  },

  async bootstrap() {
    await this.callApi("login", {});
    const dashboard = await this.callApi("getDashboard", {});
    if (dashboard && dashboard.success && dashboard.data) {
      this.setData(dashboard.data);
    }
  },

  async callApi(action, data) {
    if (!app.globalData.env) return null;
    try {
      const res = await wx.cloud.callFunction({
        name: "tomatoLedger",
        data: { action, data },
      });
      return res.result;
    } catch (error) {
      console.warn("tomatoLedger fallback", action, error);
      return null;
    }
  },

  goRecordEdit() {
    if (this.data.readonly) {
      wx.showToast({ title: "只读账本不能记账", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/record-edit/index" });
  },

  goRecords() {
    wx.switchTab({ url: "/pages/records/index" });
  },
});
