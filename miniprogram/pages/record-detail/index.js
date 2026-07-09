const app = getApp();

function money(value) {
  const num = Number(value || 0);
  return num.toFixed(num % 1 === 0 ? 0 : 2);
}

function getLedgerTypeText(type) {
  return type === "shared" ? "共享账本" : "个人账本";
}

function getTypeText(type) {
  return type === "income" ? "收入" : "支出";
}

function normalizeRecord(record = {}, ledger = {}) {
  const type = record.type === "income" ? "income" : "expense";
  const selectedTimeText = [record.date, record.time].filter(Boolean).join(" ") || "未选择时间";
  const tags = Array.isArray(record.tags) ? record.tags : [];
  return {
    ...record,
    id: record.id || record._id || "",
    type,
    typeText: getTypeText(type),
    typeIcon: type === "income" ? "funds-line" : "price-tag-3-line",
    typeIconColor: type === "income" ? "#25a66a" : "#f0442f",
    amountText: money(record.amount),
    sign: type === "income" ? "+" : "-",
    categoryText: record.categoryName || record.categoryLabel || "其他",
    parentCategoryText: record.parentCategory || "未分类",
    selectedTimeText,
    ledgerName: ledger.name || "我的账本",
    ledgerTypeText: getLedgerTypeText(ledger.type),
    memberName: record.memberName || "我",
    memberAvatar: record.memberAvatar || "/images/brand/tomato-ledger-logo-256-transparent.png",
    accountText: record.account || "未选择账户",
    noteText: record.note || "未填写备注",
    tags,
    hasTags: tags.length > 0,
  };
}

Page({
  data: {
    loading: true,
    isError: false,
    recordId: "",
    record: null,
    readonly: false,
  },

  onLoad(options = {}) {
    const recordId = options.id ? decodeURIComponent(options.id) : "";
    this.setData({ recordId });
    this.loadRecord(recordId);
  },

  async callApi(action, data = {}) {
    if (!app.globalData.env) return null;
    const res = await wx.cloud.callFunction({
      name: "tomatoLedger",
      data: { action, data },
    });
    return res.result;
  },

  async loadRecord(recordId) {
    if (!recordId) {
      this.setData({ loading: false, isError: true });
      return;
    }

    this.setData({ loading: true, isError: false });
    try {
      const result = await this.callApi("getRecord", { recordId });
      if (!result || !result.success || !result.data || !result.data.record) {
        throw new Error((result && result.message) || "记录加载失败");
      }

      this.setData({
        loading: false,
        readonly: Boolean(result.data.readonly),
        record: normalizeRecord(result.data.record, result.data.ledger),
      });
    } catch (error) {
      console.warn("load record detail failed", error);
      this.setData({ loading: false, isError: true });
    }
  },

  reload() {
    this.loadRecord(this.data.recordId);
  },
});
