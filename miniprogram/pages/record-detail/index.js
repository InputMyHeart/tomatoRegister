const recordService = require("../../services/record.service");
const { formatDisplayMoney } = require("../../utils/money");
const { formatDateTime } = require("../../utils/date");
const { getId } = require("../../utils/mapper");

function getLedgerTypeText(type) {
  return type === "shared" ? "共享账本" : "个人账本";
}

function getTypeText(type) {
  return type === "income" ? "收入" : "支出";
}

function normalizeRecord(record = {}, ledger = {}) {
  const type = record.type === "income" ? "income" : "expense";
  const selectedTimeText = formatDateTime(record.date, record.time);
  const tags = Array.isArray(record.tags) ? record.tags : [];
  return {
    ...record,
    id: getId(record),
    type,
    typeText: getTypeText(type),
    typeIcon: type === "income" ? "funds-line" : "price-tag-3-line",
    typeIconColor: type === "income" ? "#25a66a" : "#f0442f",
    amountText: formatDisplayMoney(record.amount),
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

  async loadRecord(recordId) {
    if (!recordId) {
      this.setData({ loading: false, isError: true });
      return;
    }

    this.setData({ loading: true, isError: false });
    try {
      const data = await recordService.getRecord(recordId);
      if (!data.record) throw new Error("记录加载失败");

      this.setData({
        loading: false,
        readonly: Boolean(data.readonly),
        record: normalizeRecord(data.record, data.ledger),
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
