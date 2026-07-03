Page({
  data: {
    monthExpense: 6240.8,
    monthIncome: 16800,
    budget: 9000,
    budgetRate: 69,
    dailyAvailable: 92,
    incomeRate: 73,
    expenseRate: 27,
    saveRate: 63,
    topCategory: "住房",
    insightText: "支出主要集中在住房和餐饮，整体仍在预算内。",
    categories: [
      { name: "住房", amount: 2200, rate: 35, color: "amber" },
      { name: "餐饮", amount: 1680, rate: 27, color: "tomato" },
      { name: "育儿", amount: 980, rate: 16, color: "green" },
      { name: "交通", amount: 420, rate: 7, color: "blue" },
    ],
    members: [
      { name: "我", amount: 3520, rate: 56 },
      { name: "家人", amount: 2720.8, rate: 44 },
    ],
  },
});
