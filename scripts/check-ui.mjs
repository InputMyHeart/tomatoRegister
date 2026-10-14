import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const UI_ROOT = path.join(ROOT, "miniprogram");
const ALLOWLIST_PATH = path.join(ROOT, "config", "ui-allowlist.json");
const UPDATE_ALLOWLIST = process.argv.includes("--update-allowlist");
const IGNORED_PARTS = ["components/ec-canvas"];

function normalize(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

function walk(directory, extensions, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const relative = normalize(file);
    if (IGNORED_PARTS.some((part) => relative.includes(part))) continue;
    if (entry.isDirectory()) walk(file, extensions, output);
    else if (extensions.some((extension) => entry.name.endsWith(extension))) output.push(file);
  }
  return output;
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function addViolation(violations, rule, file, source, index, message) {
  const relative = normalize(file);
  const line = lineNumber(source, index);
  violations.push({
    id: `${rule}:${relative}:${line}`,
    rule,
    file: relative,
    line,
    message,
  });
}

function collectViolations() {
  const violations = [];
  const styleFiles = walk(UI_ROOT, [".wxss"]);
  const templateFiles = walk(UI_ROOT, [".wxml"]);
  const scriptFiles = walk(UI_ROOT, [".js"]);
  for (const file of scriptFiles) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /wx\.(?:showToast|hideToast|showLoading|hideLoading)\s*\(/g
    )) {
      addViolation(
        violations,
        "native-feedback",
        file,
        source,
        match.index,
        "Toast 和 Loading 必须通过 services/feedback-ui 调用"
      );
    }
  }
  const tokenDefinitions = new Set();
  const tokenUses = [];

  for (const file of styleFiles) {
    const source = fs.readFileSync(file, "utf8");
    const relative = normalize(file);
    const isTabbar = relative === "miniprogram/components/tl-tabbar/index.wxss";
    const isPage = relative.startsWith("miniprogram/pages/");
    const isApprovedGradient =
      relative === "miniprogram/app.wxss" ||
      relative === "miniprogram/components/tl-tabbar/index.wxss" ||
      relative === "miniprogram/components/tl-skeleton/index.wxss";

    for (const match of source.matchAll(/(--tl-[\w-]+)\s*:/g)) tokenDefinitions.add(match[1]);
    for (const match of source.matchAll(/var\((--tl-[\w-]+)/g)) {
      tokenUses.push({ file, source, index: match.index, name: match[1] });
    }

    for (const match of source.matchAll(/(?:box-shadow|filter\s*:\s*drop-shadow)\s*:[^;]+;/gi)) {
      if (/box-shadow\s*:\s*none/i.test(match[0])) continue;
      if (!isTabbar)
        addViolation(violations, "shadow", file, source, match.index, "仅 tl-tabbar 允许阴影");
    }

    if (isPage) {
      for (const match of source.matchAll(/position\s*:\s*fixed\s*;/gi)) {
        addViolation(
          violations,
          "page-fixed",
          file,
          source,
          match.index,
          "页面不得自行创建 fixed 底部能力或浮层"
        );
      }
      for (const match of source.matchAll(/safe-area-inset-bottom/gi)) {
        addViolation(
          violations,
          "page-safe-area",
          file,
          source,
          match.index,
          "底部安全区必须由公共组件负责"
        );
      }
      for (const match of source.matchAll(/@keyframes\s+[\w-]*(?:spin|spinner)[\w-]*/gi)) {
        addViolation(
          violations,
          "page-spinner",
          file,
          source,
          match.index,
          "页面 Loading 动画必须由状态或按钮组件负责"
        );
      }
    }

    if (!isApprovedGradient) {
      for (const match of source.matchAll(/(?:linear|radial)-gradient\(/gi)) {
        addViolation(violations, "gradient", file, source, match.index, "普通组件不得自行增加渐变");
      }
    }

    if (relative !== "miniprogram/app.wxss") {
      for (const match of source.matchAll(/(?:^|[;{]\s*)font-(?:size|weight)\s*:\s*\d+/gim)) {
        addViolation(
          violations,
          "hardcoded-typography",
          file,
          source,
          match.index,
          "Typography must use UI tokens"
        );
      }
      for (const match of source.matchAll(/border-radius\s*:\s*[^;]*\d+rpx/gi)) {
        addViolation(
          violations,
          "hardcoded-radius",
          file,
          source,
          match.index,
          "Radii must use UI tokens, percentages or zero"
        );
      }
    }
  }

  for (const use of tokenUses) {
    if (!tokenDefinitions.has(use.name)) {
      addViolation(
        violations,
        "undefined-token",
        use.file,
        use.source,
        use.index,
        "Undefined UI token: " + use.name
      );
    }
  }

  for (const file of templateFiles) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /<tl-tabbar\b[^>]*show-tabs\s*=\s*["']\{\{false\}\}["']/gi
    )) {
      addViolation(
        violations,
        "hidden-tabbar",
        file,
        source,
        match.index,
        "普通页面不得使用隐藏 Tabbar 占位"
      );
    }

    const stack = [];
    const voidElements = new Set(["image", "input"]);
    for (const match of source.matchAll(/<\/?([\w-]+)\b[^>]*>/g)) {
      const [tag, name] = match;
      if (voidElements.has(name)) continue;
      if (tag.startsWith("</")) {
        const opened = stack.pop();
        if (opened !== name) {
          addViolation(
            violations,
            "wxml-structure",
            file,
            source,
            match.index,
            "Mismatched tags: " + (opened || "none") + " / " + name
          );
          break;
        }
      } else if (!tag.endsWith("/>")) {
        stack.push(name);
      }
    }
    if (stack.length) {
      addViolation(
        violations,
        "wxml-structure",
        file,
        source,
        source.length,
        "Unclosed tags: " + stack.join(", ")
      );
    }
  }

  return violations.sort((left, right) => left.id.localeCompare(right.id));
}

const violations = collectViolations();

if (UPDATE_ALLOWLIST) {
  fs.mkdirSync(path.dirname(ALLOWLIST_PATH), { recursive: true });
  fs.writeFileSync(
    ALLOWLIST_PATH,
    `${JSON.stringify({ violations: violations.map(({ id }) => id) }, null, 2)}\n`,
    "utf8"
  );
  console.log(`Updated UI allowlist with ${violations.length} existing violations.`);
  process.exit(0);
}

const allowlist = fs.existsSync(ALLOWLIST_PATH)
  ? JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8")).violations || []
  : [];
const allowed = new Set(allowlist);
const current = new Set(violations.map(({ id }) => id));
const unexpected = violations.filter(({ id }) => !allowed.has(id));
const stale = allowlist.filter((id) => !current.has(id));

if (unexpected.length || stale.length) {
  for (const violation of unexpected) {
    console.error(`${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
  }
  for (const id of stale) console.error(`[stale-allowlist] ${id}`);
  console.error(
    "Run `npm run ui:allowlist` only when intentionally refreshing the migration baseline."
  );
  process.exit(1);
}

console.log(`UI checks passed (${violations.length} allowlisted violations remain).`);
