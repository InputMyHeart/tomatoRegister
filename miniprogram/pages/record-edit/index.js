const app = getApp();
const recordService = require("../../services/record.service");
const accounts = ["微信", "支付宝", "银行卡", "现金"];

function today() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function quickAmountsFor(ledger) {
  return ledger && ledger.quickAmountsEnabled && Array.isArray(ledger.quickAmounts)
    ? ledger.quickAmounts
    : [];
}

function quickNotesFor(type, category) {
  if (type === "income") return [category, "工资", "奖金", "报销", "红包"].filter(Boolean);
  return [category, "早餐", "午餐", "晚餐", "通勤", "买菜"].filter(Boolean);
}

function limitAmountPrecision(rawValue) {
  return String(rawValue || "").replace(/(\.\d{2})\d+/g, "$1");
}

function amountPartToCents(part) {
  const negative = part.startsWith("-");
  const source = part.replace(/^[+-]/, "");
  const [whole, fraction = ""] = source.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return negative ? -cents : cents;
}

function centsToText(cents) {
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${cents < 0 ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function evaluateAmountExpression(rawValue) {
  const expression = limitAmountPrecision(rawValue).replace(/\s/g, "");
  if (!expression) return { value: 0, valid: false, text: "" };
  if (!/^\d+(\.\d{1,2})?([+-]\d+(\.\d{1,2})?)*$/.test(expression)) {
    return { value: 0, valid: false, text: "" };
  }
  const cents = (expression.match(/[+-]?\d+(\.\d{1,2})?/g) || []).reduce(
    (sum, part) => sum + amountPartToCents(part),
    0
  );
  return { value: cents / 100, valid: cents > 0, text: centsToText(cents) };
}

function normalizeTags(input) {
  return String(input || "")
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

Page({
  data: {
    recordId: "",
    isEditing: false,
    type: "expense",
    typeLabel: "支出",
    typeIcon: "price-tag-3-line",
    categoryName: "其他支出",
    categoryLabel: "其他",
    categoryIcon: "price-tag-3-line",
    parentCategory: "生活",
    parentIcon: "book-2-line",
    amount: "",
    amountResult: "",
    showAmountResult: false,
    canSave: false,
    saving: false,
    note: "",
    tagInput: "",
    tags: [],
    date: today(),

    ledgerName: "我家账本",
    ledgerId: "",
    accountIndex: 0,
    accounts,
    quickAmounts: [],
    quickNotes: quickNotesFor("expense", "其他支出"),
  },

  onLoad(options = {}) {
    const type = options.type === "income" ? "income" : "expense";
    const fallbackCategory = type === "income" ? "其他收入" : "其他支出";
    const fallbackLabel = type === "income" ? "其他" : "其他";
    const categoryName = options.category ? decodeURIComponent(options.category) : fallbackCategory;
    const categoryLabel = options.categoryLabel
      ? decodeURIComponent(options.categoryLabel)
      : fallbackLabel;
    const categoryIcon = options.categoryIcon
      ? decodeURIComponent(options.categoryIcon)
      : "price-tag-3-line";
    const parentCategory = options.parentCategory
      ? decodeURIComponent(options.parentCategory)
      : type === "income"
        ? "其他收入"
        : "生活";
    const parentIcon = options.parentIcon
      ? decodeURIComponent(options.parentIcon)
      : type === "income"
        ? "price-tag-3-line"
        : "book-2-line";
    const currentLedger = app.globalData.currentLedger || {};
    this.setData({
      type,
      typeLabel: type === "income" ? "收入" : "支出",
      typeIcon: type === "income" ? "funds-line" : "price-tag-3-line",
      categoryName,
      categoryLabel,
      categoryIcon,
      parentCategory,
      parentIcon,
      ledgerName: currentLedger.name || "我家账本",
      ledgerId: options.ledgerId || currentLedger._id || "",
      quickAmounts: quickAmountsFor(currentLedger),
      quickNotes: quickNotesFor(type, categoryName),
    });
    if (options.id) this.loadRecord(decodeURIComponent(options.id));
  },

  async loadRecord(recordId) {
    try {
      const data = await recordService.getRecord(recordId);
      const record = data.record;
      if (!record) throw new Error("记录加载失败");
      const recordType = record.type === "income" ? "income" : "expense";
      const accountIndex = Math.max(0, accounts.indexOf(record.account));
      this.setData({
        recordId,
        isEditing: true,
        type: recordType,
        typeLabel: recordType === "income" ? "收入" : "支出",
        typeIcon: recordType === "income" ? "funds-line" : "price-tag-3-line",
        categoryName: record.categoryName || "其他",
        categoryLabel: record.categoryLabel || record.categoryName || "其他",
        categoryIcon: record.categoryIcon || "price-tag-3-line",
        parentCategory: record.parentCategory || "",
        parentIcon: record.parentIcon || "",
        amount: String(record.amount || ""),
        note: record.note || "",
        tags: Array.isArray(record.tags) ? record.tags : [],
        date: record.date || today(),
        ledgerId: record.ledgerId || "",
        ledgerName: (data.ledger && data.ledger.name) || "我的账本",
        accountIndex,
        quickAmounts: quickAmountsFor(data.ledger),
        quickNotes: quickNotesFor(recordType, record.categoryName),
      });
      this.setAmountExpression(String(record.amount || ""));
    } catch (error) {
      wx.showToast({ title: error.message || "记录加载失败", icon: "none" });
      setTimeout(() => wx.navigateBack(), 500);
    }
  },
  applyCategorySelection(selection = {}) {
    const type = selection.type === "income" ? "income" : "expense";
    this.setData({
      type,
      typeLabel: type === "income" ? "收入" : "支出",
      typeIcon: type === "income" ? "funds-line" : "price-tag-3-line",
      categoryName: selection.categoryName || this.data.categoryName,
      categoryLabel: selection.categoryLabel || selection.categoryName || this.data.categoryLabel,
      categoryIcon: selection.categoryIcon || this.data.categoryIcon,
      parentCategory: selection.parentCategory || this.data.parentCategory,
      parentIcon: selection.parentIcon || this.data.parentIcon,
      quickNotes: quickNotesFor(type, selection.categoryName || this.data.categoryName),
    });
  },

  setQuickAmount(event) {
    const amount = String(event.detail.amount || event.currentTarget.dataset.amount);
    this.setAmountExpression(amount);
  },

  setQuickNote(event) {
    this.setData({ note: event.currentTarget.dataset.note });
  },

  setAmountExpression(amount) {
    const result = evaluateAmountExpression(amount);
    this.setData({
      amount,
      amountResult: result.text,
      showAmountResult: /[+-]/.test(amount) && result.valid,
      canSave: result.valid,
    });
  },

  reselectCategory() {
    const params = [`type=${this.data.type}`, "mode=reselect"];
    if (this.data.ledgerId) params.push(`ledgerId=${encodeURIComponent(this.data.ledgerId)}`);
    wx.navigateTo({ url: `/pages/record-category/index?${params.join("&")}` });
  },

  onAmountInput(event) {
    this.setAmountExpression(event.detail.value);
  },
  onNoteInput(event) {
    this.setData({ note: String(event.detail.value || "").slice(0, 100) });
  },
  onDateChange(event) {
    this.setData({ date: event.detail.value });
  },
  onAccountChange(event) {
    this.setData({ accountIndex: Number(event.detail.value) });
  },
  onTagInput(event) {
    this.setData({ tagInput: event.detail.value });
  },

  addTag() {
    const incoming = normalizeTags(this.data.tagInput);
    if (!incoming.length) return;
    const tags = Array.from(new Set([...this.data.tags, ...incoming])).slice(0, 8);
    this.setData({ tags, tagInput: "" });
  },

  removeTag(event) {
    const index = Number(
      event.detail.index !== undefined ? event.detail.index : event.currentTarget.dataset.index
    );
    const tags = this.data.tags.filter((_, itemIndex) => itemIndex !== index);
    this.setData({ tags });
  },

  async deleteRecord() {
    if (!this.data.isEditing || !this.data.recordId || this.data.saving || this.data.deleting)
      return;
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: "删除记录",
        content: "删除后无法恢复，确定删除这条记录吗？",
        confirmText: "删除",
        confirmColor: "#f0442f",
        success: (result) => resolve(Boolean(result.confirm)),
        fail: () => resolve(false),
      });
    });
    if (!confirmed) return;

    this.setData({ deleting: true });
    try {
      await recordService.deleteRecord(this.data.recordId);
      app.globalData.recordsNeedRefresh = true;
      wx.showToast({ title: "已删除", icon: "success" });
      setTimeout(() => wx.navigateBack(), 650);
    } catch (error) {
      console.warn("deleteRecord failed", error);
      wx.showToast({ title: error.message || "删除失败", icon: "none" });
    } finally {
      this.setData({ deleting: false });
    }
  },
  async saveRecord() {
    if (this.data.saving) return;
    const finalTags = Array.from(
      new Set([...this.data.tags, ...normalizeTags(this.data.tagInput)])
    ).slice(0, 8);
    this.setData({ tags: finalTags, tagInput: "" });
    const result = evaluateAmountExpression(this.data.amount);
    if (!result.valid) {
      wx.showToast({ title: "请输入有效金额", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    try {
      const payload = {
        recordId: this.data.recordId,
        ledgerId: this.data.ledgerId,
        type: this.data.type,
        amount: result.value,
        note: this.data.note,
        tags: finalTags,
        date: this.data.date,
        categoryName: this.data.categoryName,
        categoryLabel: this.data.categoryLabel,
        categoryIcon: this.data.categoryIcon,
        parentCategory: this.data.parentCategory,
        parentIcon: this.data.parentIcon,
        account: this.data.accounts[this.data.accountIndex],
      };
      if (this.data.isEditing) await recordService.updateRecord(payload);
      else await recordService.createRecord(payload);
      app.globalData.recordsNeedRefresh = true;
      wx.showToast({ title: this.data.isEditing ? "已保存" : "已记账", icon: "success" });
      setTimeout(() => wx.navigateBack(), 650);
    } catch (error) {
      console.warn("saveRecord failed", error);
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
