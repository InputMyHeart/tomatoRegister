const expenseCategories = ["餐饮", "购物", "交通", "住房", "水电", "通讯", "医疗", "育儿", "学习", "娱乐", "人情", "旅行", "其他"];
const incomeCategories = ["工资", "奖金", "副业", "红包", "报销", "理财", "其他"];
const accounts = ["微信", "支付宝", "银行卡", "现金"];

Page({
  data: {
    type: "expense",
    amount: "",
    note: "",
    date: "2026-07-01",
    accountIndex: 0,
    categoryIndex: 0,
    accounts,
    categories: expenseCategories,
    quickAmounts: [18, 32, 68, 128],
    quickNotes: ["早餐", "午餐", "晚餐", "通勤", "买菜"],
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      type,
      categoryIndex: 0,
      categories: type === "expense" ? expenseCategories : incomeCategories,
      quickAmounts: type === "expense" ? [18, 32, 68, 128] : [200, 500, 1000, 5000],
      quickNotes: type === "expense" ? ["早餐", "午餐", "晚餐", "通勤", "买菜"] : ["工资", "奖金", "报销", "红包"],
    });
  },

  setQuickAmount(e) {
    this.setData({ amount: String(e.currentTarget.dataset.amount) });
  },

  selectCategory(e) {
    this.setData({ categoryIndex: Number(e.currentTarget.dataset.index) });
  },

  setQuickNote(e) {
    this.setData({ note: e.currentTarget.dataset.note });
  },

  onAmountInput(e) { this.setData({ amount: e.detail.value }); },
  onNoteInput(e) { this.setData({ note: e.detail.value }); },
  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onAccountChange(e) { this.setData({ accountIndex: Number(e.detail.value) }); },
  onCategoryChange(e) { this.setData({ categoryIndex: Number(e.detail.value) }); },

  async saveRecord() {
    const amount = Number(this.data.amount);
    if (!amount || amount <= 0) {
      wx.showToast({ title: "请输入有效金额", icon: "none" });
      return;
    }

    wx.showLoading({ title: "保存中" });
    try {
      await wx.cloud.callFunction({
        name: "tomatoLedger",
        data: {
          action: "createRecord",
          data: {
            type: this.data.type,
            amount,
            note: this.data.note,
            date: this.data.date,
            categoryName: this.data.categories[this.data.categoryIndex],
            account: this.data.accounts[this.data.accountIndex],
          },
        },
      });
    } catch (error) {
      console.warn("createRecord fallback", error);
    } finally {
      wx.hideLoading();
      wx.showToast({ title: "已记一笔", icon: "success" });
      setTimeout(() => wx.navigateBack(), 650);
    }
  },
});
