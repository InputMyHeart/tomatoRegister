Component({
  properties: {
    enabled: { type: Boolean, value: false },
    budget: { type: Number, value: 0 },
    expense: { type: Number, value: 0 },
  },
  data: { rate: 0, left: 0, barStyle: "width: 0%" },
  observers: {
    "enabled, budget, expense": function updateProgress(enabled, budget, expense) {
      const safeBudget = Number(budget) || 0;
      const safeExpense = Number(expense) || 0;
      this.setData({
        rate: safeBudget > 0 ? Math.min(100, Math.round((safeExpense / safeBudget) * 100)) : 0,
        left: safeBudget - safeExpense,
        barStyle:
          "width: " +
          (safeBudget > 0 ? Math.min(100, Math.round((safeExpense / safeBudget) * 100)) : 0) +
          "%",
      });
    },
  },
});
