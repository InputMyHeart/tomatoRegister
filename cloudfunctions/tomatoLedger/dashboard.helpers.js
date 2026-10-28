const { roundMoney, summarizeRecords } = require("./analysis.helpers");

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

function summarizeDashboardGroups(typeGroups = [], topCategory = "") {
  let income = 0;
  let expense = 0;
  let recordCount = 0;
  let largestExpense = 0;
  typeGroups.forEach((group) => {
    recordCount += Number(group.count || 0);
    if (group._id === "income") income += Number(group.total || 0);
    if (group._id === "expense") {
      expense += Number(group.total || 0);
      largestExpense = Math.max(largestExpense, Number(group.largest || 0));
    }
  });
  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    balance: roundMoney(income - expense),
    recordCount,
    largestExpense: roundMoney(largestExpense),
    topExpenseCategory: topCategory || "其他",
  };
}

module.exports = { loadAllMonthRecords, summarizeDashboardRecords, summarizeDashboardGroups };
