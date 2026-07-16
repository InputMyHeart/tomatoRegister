import fs from "fs";
import path from "path";
const root = "miniprogram";
const check = process.argv.includes("--check");
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
    );
}
function tokenize(source) {
  const tokens = [];
  let cursor = 0;
  let textStart = 0;
  let quote = "";
  while (cursor < source.length) {
    if (source[cursor] !== "<") {
      cursor += 1;
      continue;
    }
    let end = cursor + 1;
    quote = "";
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (quote) {
        if (char === quote) quote = "";
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === ">") break;
    }
    if (end >= source.length) {
      cursor += 1;
      continue;
    }
    const text = source.slice(textStart, cursor).trim();
    if (text) tokens.push({ type: "text", value: text });
    tokens.push({ type: "tag", value: source.slice(cursor, end + 1).trim() });
    cursor = end + 1;
    textStart = cursor;
  }
  const text = source.slice(textStart).trim();
  if (text) tokens.push({ type: "text", value: text });
  return tokens;
}
function format(source) {
  const tokens = tokenize(source);
  const lines = [];
  let level = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "text") {
      lines.push("  ".repeat(level) + token.value);
      continue;
    }
    const tag = token.value;
    if (tag.startsWith("</")) {
      level = Math.max(0, level - 1);
      lines.push("  ".repeat(level) + tag);
      continue;
    }
    const selfClosing = tag.endsWith("/>") || tag.startsWith("<!--") || tag.startsWith("<!");
    const next = tokens[index + 1];
    const close = tokens[index + 2];
    if (
      !selfClosing &&
      next &&
      next.type === "text" &&
      close &&
      close.type === "tag" &&
      close.value.startsWith("</")
    ) {
      lines.push("  ".repeat(level) + tag + next.value + close.value);
      index += 2;
      continue;
    }
    lines.push("  ".repeat(level) + tag);
    if (!selfClosing) level += 1;
  }
  return lines.join("\n") + "\n";
}
const changed = [];
for (const file of files(root).filter((file) => file.endsWith(".wxml"))) {
  const input = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const output = format(input);
  if (input !== output) {
    changed.push(file);
    if (!check) fs.writeFileSync(file, output, "utf8");
  }
}
if (check && changed.length) {
  console.error("Unformatted WXML:\n" + changed.join("\n"));
  process.exit(1);
}
console.log(check ? "WXML format check passed." : "Formatted " + changed.length + " WXML file(s).");
