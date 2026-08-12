import fs from "fs";
import path from "path";

const ROOT = "miniprogram";
const EXCLUDED_PARTS = [path.join("components", "ec-canvas")];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function isProjectUiFile(file) {
  return !EXCLUDED_PARTS.some((part) => file.includes(part));
}

function collectMatches(files, pattern, normalize = (value) => value) {
  const values = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(pattern)) {
      const value = normalize(match[1]);
      const item = values.get(value) || { count: 0, files: new Set() };
      item.count += 1;
      item.files.add(file.replaceAll("\\", "/"));
      values.set(value, item);
    }
  }
  return [...values.entries()]
    .map(([value, item]) => ({ value, count: item.count, files: [...item.files].sort() }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function filesMatching(files, pattern) {
  return files
    .filter((file) => pattern.test(fs.readFileSync(file, "utf8")))
    .map((file) => file.replaceAll("\\", "/"))
    .sort();
}

function collectComponents(files) {
  const components = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/<(tl-[a-z0-9-]+)(?:\s|>)/g)) {
      const name = match[1];
      const item = components.get(name) || { count: 0, files: new Set() };
      item.count += 1;
      item.files.add(file.replaceAll("\\", "/"));
      components.set(name, item);
    }
  }
  return [...components.entries()]
    .map(([name, item]) => ({ name, count: item.count, files: [...item.files].sort() }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const allFiles = walk(ROOT).filter(isProjectUiFile);
const wxssFiles = allFiles.filter((file) => file.endsWith(".wxss"));
const wxmlFiles = allFiles.filter((file) => file.endsWith(".wxml"));

const report = {
  generatedAt: new Date().toISOString(),
  scope: {
    wxssFiles: wxssFiles.length,
    wxmlFiles: wxmlFiles.length,
    excluded: EXCLUDED_PARTS.map((item) => item.replaceAll("\\", "/")),
  },
  values: {
    colors: collectMatches(wxssFiles, /(?<![\w-])(#[0-9a-fA-F]{3,8})(?![\w-])/g, (value) =>
      value.toLowerCase()
    ),
    fontSizes: collectMatches(wxssFiles, /font-size:\s*([^;\n]+)/g, (value) => value.trim()),
    fontWeights: collectMatches(wxssFiles, /font-weight:\s*([^;\n]+)/g, (value) => value.trim()),
    radii: collectMatches(wxssFiles, /border-radius:\s*([^;\n]+)/g, (value) => value.trim()),
    shadows: collectMatches(wxssFiles, /box-shadow:\s*([^;\n]+)/g, (value) => value.trim()),
    zIndexes: collectMatches(wxssFiles, /z-index:\s*([^;\n]+)/g, (value) => value.trim()),
    paddings: collectMatches(wxssFiles, /(?:^|\n)\s*padding:\s*([^;\n]+)/g, (value) =>
      value.trim()
    ),
    gaps: collectMatches(wxssFiles, /(?:^|\n)\s*gap:\s*([^;\n]+)/g, (value) => value.trim()),
  },
  layout: {
    fixed: filesMatching(wxssFiles, /position:\s*fixed/),
    sticky: filesMatching(wxssFiles, /position:\s*sticky/),
    safeAreaBottom: filesMatching(wxssFiles, /safe-area-inset-bottom/),
    keyframes: collectMatches(wxssFiles, /@keyframes\s+([\w-]+)/g),
  },
  states: {
    loading: filesMatching(
      [...wxmlFiles, ...allFiles.filter((file) => file.endsWith(".js"))],
      /\b(?:loading|isLoading|loadingMore)\b/
    ),
    empty: filesMatching(wxmlFiles, /(?:tl-empty-state|\bempty\b|isEmpty|暂无)/),
    error: filesMatching(wxmlFiles, /(?:\berror\b|isError|加载失败|重试)/),
  },
  components: collectComponents(wxmlFiles),
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`UI audit: ${report.scope.wxssFiles} WXSS, ${report.scope.wxmlFiles} WXML`);
  for (const [name, values] of Object.entries(report.values)) {
    console.log(`${name}: ${values.length} distinct values`);
  }
  console.log(`fixed: ${report.layout.fixed.length} files`);
  console.log(`safe-area bottom: ${report.layout.safeAreaBottom.length} files`);
  console.log(`custom components used: ${report.components.length}`);
}
