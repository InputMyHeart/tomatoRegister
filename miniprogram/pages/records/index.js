const demoRecords = [
  { id: "r1", type: "expense", categoryName: "餐饮", amount: 86.5, note: "周末家庭晚餐", date: "2026-07-02", time: "19:20", account: "微信", ownerName: "我", remark: "番茄牛腩和水果", canEdit: true },
  { id: "r2", type: "expense", categoryName: "育儿", amount: 260, note: "绘本和文具", date: "2026-07-02", time: "16:05", account: "支付宝", ownerName: "家人", remark: "幼儿园手工课材料", canEdit: false },
  { id: "r3", type: "income", categoryName: "工资", amount: 12800, note: "月度工资", date: "2026-07-01", time: "09:12", account: "银行卡", ownerName: "我", remark: "七月工资入账", canEdit: true },
  { id: "r4", type: "expense", categoryName: "交通", amount: 32, note: "地铁通勤", date: "2026-07-01", time: "08:40", account: "微信", ownerName: "家人", remark: "早晚通勤", canEdit: false },
  { id: "r5", type: "expense", categoryName: "购物", amount: 148.9, note: "厨房清洁用品", date: "2026-06-30", time: "20:18", account: "微信", ownerName: "我", remark: "洗碗块、保鲜袋", canEdit: true },
];

const weekdayMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function money(value) {
  return Number(value || 0).toFixed(value % 1 === 0 ? 0 : 2);
}

function formatDateLabel(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function buildView(records, activeType) {
  const visibleRecords = activeType === "all" ? records : records.filter((item) => item.type === activeType);
  const groups = [];
  const groupMap = {};

  visibleRecords.forEach((record) => {
    const normalized = {
      ...record,
      amount: money(record.amount),
      sign: record.type === "income" ? "+" : "-",
      dateLabel: formatDateLabel(record.date),
    };
    if (!groupMap[record.date]) {
      const date = new Date(`${record.date}T00:00:00`);
      groupMap[record.date] = {
        date: record.date,
        dateLabel: normalized.dateLabel,
        weekday: weekdayMap[date.getDay()],
        income: 0,
        expense: 0,
        records: [],
      };
      groups.push(groupMap[record.date]);
    }
    const group = groupMap[record.date];
    if (record.type === "income") group.income += Number(record.amount);
    if (record.type === "expense") group.expense += Number(record.amount);
    group.records.push(normalized);
  });

  const visibleIncome = visibleRecords
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const visibleExpense = visibleRecords
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  return {
    visibleRecords: visibleRecords.map((record) => ({ ...record, amount: money(record.amount), sign: record.type === "income" ? "+" : "-", dateLabel: formatDateLabel(record.date) })),
    recordGroups: groups.map((group) => ({
      ...group,
      income: money(group.income),
      expense: money(group.expense),
    })),
    visibleIncome: money(visibleIncome),
    visibleExpense: money(visibleExpense),
    visibleCount: visibleRecords.length,
    hasRecords: visibleRecords.length > 0,
  };
}

Page({
  data: {
    ledgerName: "我家账本",
    monthLabel: "2026年7月",
    activeType: "all",
    readonly: false,
    records: demoRecords,
    detailVisible: false,
    selectedRecord: null,
    ...buildView(demoRecords, "all"),
  },

  switchType(e) {
    const activeType = e.currentTarget.dataset.type;
    this.setData({ activeType, ...buildView(this.data.records, activeType) });
  },

  switchLedger() {
    wx.showToast({ title: "账本切换入口已预留", icon: "none" });
  },

  prevMonth() {
    wx.showToast({ title: "切换上个月", icon: "none" });
  },

  nextMonth() {
    wx.showToast({ title: "切换下个月", icon: "none" });
  },

  openRecord(e) {
    const id = e.currentTarget.dataset.id;
    const selectedRecord = this.data.visibleRecords.find((item) => item.id === id);
    if (!selectedRecord) return;
    this.setData({ selectedRecord, detailVisible: true });
  },

  closeDetail() {
    this.setData({ detailVisible: false });
  },

  editSelected() {
    const { selectedRecord, readonly } = this.data;
    if (!selectedRecord || readonly || !selectedRecord.canEdit) {
      wx.showToast({ title: "暂无权限操作这笔记录", icon: "none" });
      return;
    }
    wx.navigateTo({ url: `/pages/record-edit/index?id=${selectedRecord.id}` });
  },
});