// Dashboard 域：首页数据聚合——本月收支、预算、最近记录。
const {
  db,
  _,
  $,
  ok,
  getLedgerForUser,
  getLedgerRole,
  getRoleText,
  assertReadable,
  getUsersByOpenids,
  resolveUsersAvatarUrls,
  getCurrentMonthRange,
} = require("../shared/helpers");
const { attachRecordOwner } = require("./record.handler");
const { summarizeDashboardGroups } = require("../dashboard.helpers");

async function getMonthSummary(query) {
  const parentCategory = $.ifNull(["$parentCategory", ""]);
  const categoryName = $.ifNull(["$categoryName", ""]);
  const category = $.cond({
    if: $.eq([parentCategory, ""]),
    then: $.cond({
      if: $.eq([categoryName, ""]),
      then: "其他",
      else: categoryName,
    }),
    else: parentCategory,
  });
  const [typeResult, topCategoryResult] = await Promise.all([
    db
      .collection("records")
      .aggregate()
      .match(query)
      .group({
        _id: "$type",
        total: $.sum("$amount"),
        count: $.sum(1),
        largest: $.max("$amount"),
      })
      .end(),
    db
      .collection("records")
      .aggregate()
      .match({ ...query, type: "expense" })
      .project({ amount: 1, category })
      .group({ _id: "$category", total: $.sum("$amount") })
      .sort({ total: -1, _id: 1 })
      .limit(1)
      .end(),
  ]);
  const topCategory = (topCategoryResult.list || [])[0];
  return summarizeDashboardGroups(typeResult.list || [], topCategory && topCategory._id);
}

async function getDashboard(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  if (!ledger) return ok({ noLedger: true, monthRange: getCurrentMonthRange() });
  const role = getLedgerRole(openid, ledger);
  assertReadable(role);

  const monthRange = getCurrentMonthRange();
  const query = { ledgerId: ledger._id, date: _.gte(monthRange.start).and(_.lt(monthRange.end)) };
  const [monthSummary, recentResult, totalRecordCountResult] = await Promise.all([
    getMonthSummary(query),
    db
      .collection("records")
      .where({ ledgerId: ledger._id })
      .orderBy("date", "desc")
      .orderBy("createdAt", "desc")
      .orderBy("_id", "desc")
      .limit(10)
      .get(),
    db.collection("records").where({ ledgerId: ledger._id }).count(),
  ]);
  const latestRecords = recentResult.data || [];
  const ownerMap = await resolveUsersAvatarUrls(
    await getUsersByOpenids(latestRecords.map((item) => item.ownerOpenid))
  );
  const { income: monthIncome, expense: monthExpense } = monthSummary;
  const budgetEnabled = Boolean(ledger.budgetEnabled);
  const budget = budgetEnabled ? Number(ledger.monthlyBudget || 0) : 0;
  const budgetRate = budgetEnabled && budget ? (monthExpense / budget) * 100 : 0;

  return ok({
    ledgerId: ledger._id,
    ledgerName: ledger.name,
    ledgerType: ledger.type || "personal",
    role,
    roleText: getRoleText(role),
    readonly: role === "readonly",
    monthIncome,
    monthExpense,
    balance: monthSummary.balance,
    budget,
    budgetEnabled,
    quickAmountsEnabled: Boolean(ledger.quickAmountsEnabled),
    quickAmounts: Array.isArray(ledger.quickAmounts) ? ledger.quickAmounts : [],
    budgetLeft: budgetEnabled ? Number((budget - monthExpense).toFixed(2)) : 0,
    budgetRate,
    recordCount: monthSummary.recordCount,
    totalRecordCount: totalRecordCountResult.total || 0,
    topExpenseCategory: monthSummary.topExpenseCategory,
    largestExpenseAmount: monthSummary.largestExpense,
    familyMood: monthSummary.recordCount ? "本月记录持续更新" : "本月还没有记录",
    monthRange,
    recentRecords: latestRecords.map((item) => attachRecordOwner(item, ownerMap, openid)),
  });
}

module.exports = {
  getDashboard,
};
