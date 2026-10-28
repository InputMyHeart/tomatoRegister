const ICON_GLYPHS = require("./glyphs");

const COLOR_KEY_MAP = {
  primary: "#F0442F",
  primaryDark: "#D9483B",
  income: "#25A66A",
  incomeOld: "#2F9D68",
  muted: "#9A8278",
  mutedText: "#7F6C65",
  tabInactive: "#B39A90",
  white: "#FFFFFF",
  warning: "#E76A53",
  iconUnselected: "#6F5A52",
};

Component({
  properties: {
    name: {
      type: String,
      value: "add-line",
      observer(name) {
        this.updateGlyph(name);
      },
    },
    size: {
      type: Number,
      value: 32,
    },
    color: {
      type: String,
      value: "",
    },
    colorKey: {
      type: String,
      value: "",
    },
  },

  data: {
    glyph: "",
    resolvedColor: "currentColor",
  },

  lifetimes: {
    attached() {
      this.updateGlyph(this.data.name);
      this.updateColor();
    },
  },

  observers: {
    "color, colorKey"() {
      this.updateColor();
    },
  },

  methods: {
    updateGlyph(name) {
      const codePoint = ICON_GLYPHS[name];
      const glyph = codePoint ? String.fromCodePoint(codePoint) : "";
      if (glyph !== this.data.glyph) this.setData({ glyph });
    },
    updateColor() {
      const key = this.data.colorKey;
      const direct = this.data.color;
      const resolved = COLOR_KEY_MAP[key] || direct || "currentColor";
      if (resolved !== this.data.resolvedColor) this.setData({ resolvedColor: resolved });
    },
  },
});
