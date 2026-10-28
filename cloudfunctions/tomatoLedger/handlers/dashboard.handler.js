// Dashboard 域：首页数据聚合——本月收支、预算、最近记录。
const {
  db,
  _,
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
const { loadAllMonthRecords, summarizeDashboardRecords } = require("../dashboard.helpers");

async function getMonthRecords(query) {
  return loadAllMonthRecords(async (cursor, pageSize) => {
    const pageQuery = cursor
      ? _.and([
          query,
          _.or([
            { date: _.lt(cursor.date) },
            { date: cursor.date, createdAt: _.lt(cursor.createdAt) },
            {
              date: cursor.date,
              createdAt: cursor.createdAt,
              _id: _.lt(cursor._id),
            },
          ]),
        ])
      : query;
    const result = await db
      .collection("records")
      .where(pageQuery)
      .orderBy("date", "desc")
      .orderBy("createdAt", "desc")
      .orderBy("_id", "desc")
      .limit(pageSize)
      .get();
    return result.data || [];
  });
}

async function getDashboard(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  if (!ledger) return ok({ noLedger: true, monthRange: getCurrentMonthRange() });
  const role = getLedgerRole(openid, ledger);
  assertReadable(role);

  const monthRange = getCurrentMonthRange();
  const query = { ledgerId: ledger._id, date: _.gte(monthRange.start).and(_.lt(monthRange.end)) };
  const [monthRecords, recentResult, totalRecordCountResult] = await Promise.all([
    getMonthRecords(query),
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
  const monthSummary = summarizeDashboardRecords(monthRecords);
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
    familyMood: monthRecords.length ? "本月记录持续更新" : "本月还没有记录",
    monthRange,
    recentRecords: latestRecords.map((item) => attachRecordOwner(item, ownerMap, openid)),
  });
}

module.exports = {
  getDashboard,
};
