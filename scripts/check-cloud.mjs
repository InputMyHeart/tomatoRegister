import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
const root = "cloudfunctions/tomatoLedger";
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
    );
for (const file of walk(root).filter((file) => file.endsWith(".js"))) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("Cloud function syntax checks passed.");
