function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function summarizeRecords(records = []) {
  let income = 0;
  let expense = 0;
  let expenseCount = 0;
  let largestExpense = 0;
  records.forEach((record) => {
    const amount = Number(record.amount || 0);
    if (record.type === "income") income += amount;
    if (record.type === "expense") {
      expense += amount;
      expenseCount += 1;
      largestExpense = Math.max(largestExpense, amount);
    }
  });
  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    balance: roundMoney(income - expense),
    recordCount: records.length,
    expenseCount,
    averageExpense: expenseCount ? roundMoney(expense / expenseCount) : 0,
    largestExpense: roundMoney(largestExpense),
    saveRateAvailable: income > 0,
    saveRate: income ? Math.round(((income - expense) * 100) / income) : 0,
  };
}

function makeComparison(current, previous, enabled) {
  const metrics = ["income", "expense", "balance", "recordCount"];
  return metrics.reduce(
    (result, metric) => {
      const currentValue = Number(current[metric] || 0);
      const previousValue = Number(previous[metric] || 0);
      const delta = roundMoney(currentValue - previousValue);
      result[metric] = {
        current: currentValue,
        previous: previousValue,
        delta,
        rate: previousValue ? Math.round((delta * 100) / Math.abs(previousValue)) : null,
        direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
      };
      return result;
    },
    { enabled: Boolean(enabled) }
  );
}

function makeTrendBuckets(mode, range, records = []) {
  const buckets = {};
  const ensureBucket = (key, label) => {
    buckets[key] = buckets[key] || { key, label, income: 0, expense: 0, balance: 0 };
  };
  if (["month", "calendar", "custom"].includes(mode)) {
    const days = Math.round(
      (new Date(`${range.end}T00:00:00Z`) - new Date(`${range.start}T00:00:00Z`)) /
        (24 * 60 * 60 * 1000)
    );
    for (let day = 0; day < days; day += 1) {
      const key = new Date(
        new Date(`${range.start}T00:00:00Z`).getTime() + day * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .slice(0, 10);
      ensureBucket(key, `${Number(key.slice(8, 10))}\u65e5`);
    }
  } else if (mode === "year") {
    const year = range.start.slice(0, 4);
    for (let month = 1; month <= 12; month += 1) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      ensureBucket(key, `${month}月`);
    }
  } else if (records.length) {
    const years = records.map((record) => Number(record.date.slice(0, 4))).filter(Number.isFinite);
    const firstYear = Math.min(...years);
    const lastYear = Math.max(...years);
    for (let year = firstYear; year <= lastYear; year += 1) ensureBucket(String(year), `${year}年`);
  }
  records.forEach((record) => {
    const key = ["month", "calendar", "custom"].includes(mode)
      ? record.date
      : mode === "year"
        ? record.date.slice(0, 7)
        : record.date.slice(0, 4);
    const label = ["month", "calendar", "custom"].includes(mode)
      ? `${Number(record.date.slice(8, 10))}日`
      : mode === "year"
        ? `${Number(record.date.slice(5, 7))}月`
        : `${key}年`;
    ensureBucket(key, label);
    const amount = Number(record.amount || 0);
    buckets[key][record.type === "income" ? "income" : "expense"] += amount;
  });
  return Object.keys(buckets)
    .sort()
    .map((key) => ({
      ...buckets[key],
      income: roundMoney(buckets[key].income),
      expense: roundMoney(buckets[key].expense),
      balance: roundMoney(buckets[key].income - buckets[key].expense),
    }));
}

function makeRecentYearTrend(currentYear, records = [], yearCount = 5) {
  const safeCurrentYear = Number(currentYear);
  const safeYearCount = Math.max(1, Number(yearCount) || 5);
  if (!Number.isInteger(safeCurrentYear)) return [];
  const firstYear = safeCurrentYear - safeYearCount + 1;
  const buckets = {};
  for (let year = firstYear; year <= safeCurrentYear; year += 1) {
    buckets[year] = { key: String(year), label: String(year), income: 0, expense: 0 };
  }
  records.forEach((record) => {
    const year = Number(String(record.date || "").slice(0, 4));
    if (!buckets[year]) return;
    const metric = record.type === "income" ? "income" : "expense";
    buckets[year][metric] += Number(record.amount || 0);
  });
  return Object.values(buckets).map((item) => ({
    ...item,
    income: roundMoney(item.income),
    expense: roundMoney(item.expense),
    balance: roundMoney(item.income - item.expense),
  }));
}

function collapseRanking(rows = [], limit = 5) {
  if (rows.length <= limit) return rows;
  const visible = rows.slice(0, limit);
  const hidden = rows.slice(limit);
  const amount = roundMoney(hidden.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return [
    ...visible,
    { name: "其余分类", amount, rate: total ? Math.round((amount * 100) / total) : 0 },
  ];
}

module.exports = {
  collapseRanking,
  makeComparison,
  makeRecentYearTrend,
  makeTrendBuckets,
  roundMoney,
  summarizeRecords,
};
