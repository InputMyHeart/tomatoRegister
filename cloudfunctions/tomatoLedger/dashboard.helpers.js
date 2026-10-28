const { summarizeRecords } = require("./analysis.helpers");

async function loadAllMonthRecords(fetchPage, pageSize = 100) {
  const records = [];
  let cursor = null;
  while (true) {
    const page = await fetchPage(cursor, pageSize);
    records.push(...page);
    if (page.length < pageSize) return records;
    cursor = page[page.length - 1];
  }
}

function summarizeDashboardRecords(records) {
  const summary = summarizeRecords(records);
  const expenseMap = {};
  records.forEach((record) => {
    if (record.type !== "expense") return;
    const category = record.parentCategory || record.categoryName || "其他";
    expenseMap[category] = (expenseMap[category] || 0) + Number(record.amount || 0);
  });
  const topExpenseCategory =
    Object.keys(expenseMap).sort((a, b) => expenseMap[b] - expenseMap[a])[0] || "其他";
  return { ...summary, topExpenseCategory };
}

module.exports = { loadAllMonthRecords, summarizeDashboardRecords };
