const VARIANTS = ["home", "records", "list", "detail", "analysis"];

Component({
  data: {
    resolvedVariant: "list",
    gridItems: [0, 1, 2],
    recordCards: [0, 1, 2],
    recordRows: [0, 1],
  },

  properties: {
    variant: {
      type: String,
      value: "list",
    },
  },
  observers: {
    variant(value) {
      this.setData({ resolvedVariant: VARIANTS.includes(value) ? value : "list" });
    },
  },
});
