Component({
  properties: {
    enabled: { type: Boolean, value: false },
    rate: { type: Number, value: 0 },
  },
  data: { barStyle: "width: 0%" },
  observers: {
    rate(value) {
      const rate = Number(value);
      const width = Number.isFinite(rate) ? Math.max(0, Math.min(100, rate)) : 0;
      this.setData({ barStyle: `width: ${Number(width.toFixed(2))}%` });
    },
  },
});
