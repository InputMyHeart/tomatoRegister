// Analysis 域：收支分析——按时间区间聚合、对比、趋势、分类占比。
const {
  db,
  _,
  ok,
  getLedgerForUser,
  getLedgerRole,
  assertReadable,
  getUsersByOpenids,
  getCurrentMonthRange,
  makeDateText,
  addMonth,
} = require("../shared/helpers");
const {
  collapseRanking: collapseAnalysisRanking,
  makeComparison: getAnalysisComparison,
  makeRecentYearTrend: makeAnalysisRecentYearTrend,
  makeTrendBuckets: makeAnalysisTrendBuckets,
  roundMoney: roundAnalysisMoney,
  summarizeRecords: summarizeAnalysisRecords,
} = require("../analysis.helpers");

function isAnalysisDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
  );
}

function addAnalysisDays(dateText, delta) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function getAnalysisRange(mode, anchor, customStart, customEnd) {
  const current = getCurrentMonthRange();
  const today = makeDateText(current.year, current.month, current.day);
  if (mode === "all") return { start: "", end: "", label: "全部时间" };
  if (mode === "year") {
    const year = Number(anchor) || current.year;
    return {
      start: String(year) + "-01-01",
      end: String(year + 1) + "-01-01",
      label: `${year}年`,
    };
  }
  if (mode === "calendar") {
    const match = /^(\d{4})-(\d{1,2})$/.exec(String(anchor || ""));
    const year = match ? Number(match[1]) : current.year;
    const month = match ? Number(match[2]) : current.month;
    const nextMonth = addMonth(year, month, 1);
    return {
      year,
      month,
      start: makeDateText(year, month, 1),
      end: makeDateText(nextMonth.year, nextMonth.month, 1),
      label: `${year}年${month}月`,
    };
  }
  if (mode === "custom") {
    const start = isAnalysisDate(customStart) ? customStart : current.start;
    const endInclusive = isAnalysisDate(customEnd) && customEnd >= start ? customEnd : today;
    return {
      start,
      end: addAnalysisDays(endInclusive, 1),
      label: `${start} 至 ${endInclusive}`,
    };
  }
  const match = /^(\d{4})-(\d{1,2})$/.exec(String(anchor || ""));
  if (!match) return { ...current, label: `${current.year}年${current.month}月` };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const next = addMonth(year, month, 1);
  return {
    year,
    month,
    start: makeDateText(year, month, 1),
    end: makeDateText(next.year, next.month, 1),
    label: `${year}年${month}月`,
  };
}

function getMonthDayCount(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function makeComparablePeriodEnd(year, month, day) {
  const safeDay = Math.min(day, getMonthDayCount(year, month));
  return new Date(Date.UTC(year, month - 1, safeDay + 1)).toISOString().slice(0, 10);
}

async function getAnalysisRecords(query) {
  const rows = [];
  let cursor = null;
  while (true) {
    const pageQuery = cursor
      ? _.and([
          query,
          _.or([
            { date: _.gt(cursor.date) },
            { date: cursor.date, createdAt: _.gt(cursor.createdAt) },
            {
              date: cursor.date,
              createdAt: cursor.createdAt,
              _id: _.gt(cursor._id),
            },
          ]),
        ])
      : query;
    const page =
      (
        await db
          .collection("records")
          .where(pageQuery)
          .orderBy("date", "asc")
          .orderBy("createdAt", "asc")
          .orderBy("_id", "asc")
          .limit(100)
          .get()
      ).data || [];
    rows.push(...page);
    if (page.length < 100) return rows;
    cursor = page[page.length - 1];
  }
}

async function getAnalysis(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  if (!ledger) return ok({ noLedger: true });
  const role = getLedgerRole(openid, ledger);
  assertReadable(role);
  const mode = ["month", "year", "calendar", "custom", "all"].includes(data.mode)
    ? data.mode
    : "month";
  const range = getAnalysisRange(mode, data.anchor, data.customStart, data.customEnd);
  const query = { ledgerId: ledger._id };
  if (range.start) query.date = _.gte(range.start).and(_.lt(range.end));
  const records = await getAnalysisRecords(query);
  let previousRecords = [];
  const currentMonthRange = getCurrentMonthRange();
  const isCurrentMonth = mode === "month" && range.start === currentMonthRange.start;
  const isCurrentYear =
    mode === "year" && Number(range.start.slice(0, 4)) === currentMonthRange.year;
  let recentYearRecords = [];
  if (mode === "year") {
    recentYearRecords = await getAnalysisRecords({
      ledgerId: ledger._id,
      date: _.gte(String(currentMonthRange.year - 4) + "-01-01").and(
        _.lt(String(currentMonthRange.year + 1) + "-01-01")
      ),
    });
  }
  if (mode === "month" && records.length) {
    const prev = addMonth(range.year, range.month, -1),
      prevStart = makeDateText(prev.year, prev.month, 1);
    previousRecords = await getAnalysisRecords({
      ledgerId: ledger._id,
      date: _.gte(prevStart).and(
        _.lt(
          isCurrentMonth
            ? makeComparablePeriodEnd(prev.year, prev.month, currentMonthRange.day)
            : range.start
        )
      ),
    });
  }
  if (mode === "year" && records.length) {
    const year = Number(range.start.slice(0, 4));
    previousRecords = await getAnalysisRecords({
      ledgerId: ledger._id,
      date: _.gte(String(year - 1) + "-01-01").and(
        _.lt(
          isCurrentYear
            ? makeComparablePeriodEnd(year - 1, currentMonthRange.month, currentMonthRange.day)
            : range.start
        )
      ),
    });
  }
  if (["calendar", "custom"].includes(mode) && records.length) {
    const periodDays = Math.max(
      1,
      Math.round(
        (new Date(`${range.end}T00:00:00Z`) - new Date(`${range.start}T00:00:00Z`)) / 86400000
      )
    );
    const previousStart = addAnalysisDays(range.start, -periodDays);
    previousRecords = await getAnalysisRecords({
      ledgerId: ledger._id,
      date: _.gte(previousStart).and(_.lt(range.start)),
    });
  }
  const hasDailyRange = ["month", "calendar", "custom"].includes(mode);
  const analysisEnd = hasDailyRange ? range.end : "";
  const analysisDayCount = hasDailyRange
    ? mode === "month" && isCurrentMonth
      ? currentMonthRange.day
      : Math.max(
          1,
          Math.round(
            (new Date(`${analysisEnd}T00:00:00Z`) - new Date(`${range.start}T00:00:00Z`)) / 86400000
          )
        )
    : 0;
  const overview = summarizeAnalysisRecords(records);
  const previousOverview = summarizeAnalysisRecords(previousRecords);
  const expense = overview.expense;
  const categories = {},
    incomeCategories = {},
    accounts = {},
    members = {},
    dailyExpense = {};
  records.forEach((record) => {
    const amount = Number(record.amount || 0),
      isIncome = record.type === "income";
    const name = record.categoryName || record.parentCategory || "其他";
    if (isIncome) {
      incomeCategories[name] = (incomeCategories[name] || 0) + amount;
      return;
    }
    const account = String(record.account || "未设置账户");
    categories[name] = (categories[name] || 0) + amount;
    accounts[account] = (accounts[account] || 0) + amount;
    members[record.ownerOpenid] = (members[record.ownerOpenid] || 0) + amount;
    dailyExpense[record.date] = (dailyExpense[record.date] || 0) + amount;
  });
  const categoryList = Object.keys(categories)
    .filter((name) => Number(categories[name]) > 0)
    .map((name) => ({
      name,
      amount: Number(categories[name].toFixed(2)),
      rate: expense ? Math.round((categories[name] * 100) / expense) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  const incomeCategoryList = Object.keys(incomeCategories)
    .filter((name) => Number(incomeCategories[name]) > 0)
    .map((name) => ({
      name,
      amount: roundAnalysisMoney(incomeCategories[name]),
      rate: overview.income ? Math.round((incomeCategories[name] * 100) / overview.income) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  const accountList = Object.keys(accounts)
    .map((name) => ({
      name,
      amount: roundAnalysisMoney(accounts[name]),
      rate: expense ? Math.round((accounts[name] * 100) / expense) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  const previousCategory = {};
  previousRecords.forEach((record) => {
    const name = record.categoryName || record.parentCategory || "其他",
      key = (record.type === "income" ? "income:" : "expense:") + name;
    previousCategory[key] = (previousCategory[key] || 0) + Number(record.amount || 0);
  });
  const currentCategory = {};
  records.forEach((record) => {
    const name = record.categoryName || record.parentCategory || "其他",
      key = (record.type === "income" ? "income:" : "expense:") + name;
    currentCategory[key] = (currentCategory[key] || 0) + Number(record.amount || 0);
  });
  const money = (value) =>
    Number(value || 0)
      .toFixed(2)
      .replace(/\.00$/, "");
  const insights = [];
  const topExpense = categoryList[0];
  if (topExpense)
    insights.push(
      "支出最多的是" +
        topExpense.name +
        "，共 ¥" +
        money(topExpense.amount) +
        "，占支出 " +
        topExpense.rate +
        "%"
    );
  if (mode !== "all") {
    const changes = Object.keys({ ...currentCategory, ...previousCategory })
      .map((key) => ({
        key,
        current: currentCategory[key] || 0,
        previous: previousCategory[key] || 0,
      }))
      .filter((item) => item.current !== item.previous)
      .sort((a, b) => Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous));
    const change = changes[0];
    if (change) {
      const label =
          change.key.slice(change.key.indexOf(":") + 1) +
          (change.key.startsWith("income:") ? "收入" : "支出"),
        delta = change.current - change.previous;
      if (!change.previous) insights.push(label + "本期新增 ¥" + money(change.current));
      else
        insights.push(
          label +
            "较上期" +
            (delta > 0 ? "增加" : "减少") +
            " ¥" +
            money(Math.abs(delta)) +
            "，变化 " +
            Math.round((Math.abs(delta) * 100) / change.previous) +
            "%"
        );
    }
    const recordDelta = records.length - previousRecords.length;
    if (recordDelta && insights.length < 3)
      insights.push(
        "这期记了 " +
          records.length +
          " 笔，比上期" +
          (recordDelta > 0 ? "多" : "少") +
          " " +
          Math.abs(recordDelta) +
          " 笔"
      );
  } else {
    const peakDate = Object.keys(dailyExpense).sort((a, b) => dailyExpense[b] - dailyExpense[a])[0];
    if (peakDate && insights.length < 3)
      insights.push(peakDate + " 是累计支出最高的一天，共 ¥" + money(dailyExpense[peakDate]));
    const topIncome = incomeCategoryList[0];
    if (topIncome && insights.length < 3)
      insights.push(topIncome.name + "是最主要的收入来源，累计 ¥" + money(topIncome.amount));
  }
  if (!insights.length) insights.push("这段时间还没有足够的记录可以分析");
  const comparison = getAnalysisComparison(overview, previousOverview, mode !== "all");
  const insightGroups = { up: [], down: [], neutral: [...insights] };
  if (comparison.enabled) {
    const labels = {
      income: "收入",
      expense: "支出",
      balance: "结余",
    };
    Object.keys(labels).forEach((metric) => {
      const item = comparison[metric];
      if (!item || item.direction === "flat") return;
      const direction = item.direction === "up" ? "up" : "down";
      const amount = money(Math.abs(item.delta));
      insightGroups[direction].push(
        `${labels[metric]}${direction === "up" ? "上升" : "下降"} ¥${amount}`
      );
    });
  }
  const users = await getUsersByOpenids(Object.keys(members));
  return ok({
    ledger: {
      _id: ledger._id,
      name: ledger.name,
      type: ledger.type || "personal",
    },
    role,
    readonly: role === "readonly",
    mode,
    range,
    overview: {
      ...overview,
      dayCount: analysisDayCount,
      dailyExpense: hasDailyRange ? roundAnalysisMoney(expense / Math.max(1, analysisDayCount)) : 0,
    },
    previousOverview,
    comparison,
    insightGroups,
    budget: {
      enabled: isCurrentMonth && Boolean(ledger.budgetEnabled),
      amount: isCurrentMonth ? Number(ledger.monthlyBudget || 0) : 0,
      spent: expense,
      remaining: isCurrentMonth
        ? roundAnalysisMoney(Number(ledger.monthlyBudget || 0) - expense)
        : 0,
      rate:
        isCurrentMonth && Number(ledger.monthlyBudget || 0)
          ? Math.round((expense * 100) / Number(ledger.monthlyBudget || 0))
          : 0,
    },
    trend: makeAnalysisTrendBuckets(mode, range, records),
    recentYearTrend:
      mode === "year" ? makeAnalysisRecentYearTrend(currentMonthRange.year, recentYearRecords) : [],
    calendarDays:
      mode === "calendar"
        ? Object.keys(
            records.reduce((result, record) => {
              const item = result[record.date] || {
                date: record.date,
                income: 0,
                expense: 0,
                recordCount: 0,
              };
              item[record.type === "income" ? "income" : "expense"] += Number(record.amount || 0);
              item.recordCount += 1;
              result[record.date] = item;
              return result;
            }, {})
          )
            .sort()
            .map((date) => {
              const item = records
                .filter((record) => record.date === date)
                .reduce(
                  (result, record) => {
                    result[record.type === "income" ? "income" : "expense"] += Number(
                      record.amount || 0
                    );
                    result.recordCount += 1;
                    return result;
                  },
                  { date, income: 0, expense: 0, recordCount: 0 }
                );
              return {
                ...item,
                income: roundAnalysisMoney(item.income),
                expense: roundAnalysisMoney(item.expense),
              };
            })
        : [],
    calendarRecords:
      mode === "calendar"
        ? records.map((record) => ({
            _id: record._id,
            date: record.date,
            type: record.type,
            amount: Number(record.amount || 0),
            categoryName: record.parentCategory || record.categoryName || "其他",
            account: record.account || "",
            note: record.note || "",
          }))
        : [],
    topExpenseRecords:
      mode === "month"
        ? records
            .filter((record) => record.type === "expense")
            .sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))
            .slice(0, 5)
            .map((record) => ({
              _id: record._id,
              date: record.date,
              amount: roundAnalysisMoney(record.amount),
              categoryName: record.parentCategory || record.categoryName || "其他",
              categoryIcon: record.categoryIcon || "",
              account: record.account || "",
              note: record.note || "",
            }))
        : [],
    categories: categoryList,
    categoryChart: collapseAnalysisRanking(categoryList),
    incomeCategories: incomeCategoryList,
    incomeCategoryChart: collapseAnalysisRanking(incomeCategoryList),
    accounts: accountList,
    members: Object.keys(members)
      .map((id) => ({
        openid: id,
        name: (users[id] || {}).nickName || (id === openid ? "我" : "成员"),
        amount: Number(members[id].toFixed(2)),
        rate: expense ? Math.round((members[id] * 100) / expense) : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
    insights,
  });
}

module.exports = {
  getAnalysis,
};
