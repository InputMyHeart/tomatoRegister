import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const automator = require("miniprogram-automator");
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_DIR = path.join(ROOT, "tests", "visual-baseline");
const ACTUAL_DIR = path.join(ROOT, "tests", "visual-actual");
const DIFF_DIR = path.join(ROOT, "tests", "visual-diff");
const UPDATE = process.argv.includes("--update");
const CLI_PATH = process.env.TL_WECHAT_CLI || "D:\\软件\\微信web开发者工具\\cli.bat";
const CASES = [
  { name: "login", route: "/pages/login/index", loggedOut: true },
  { name: "ledger-create", route: "/pages/ledger-create/index" },
  { name: "category-icon-picker", route: "/pages/category-icon-picker/index" },
];
const MAX_DIFF_RATIO = 0.01;
const AUTOMATION_PORT = 9420;

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

async function connectWithRetry(endpoint, timeout = 30000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeout) {
    try {
      return await automator.connect({ wsEndpoint: endpoint });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

async function waitForReady(miniProgram, timeout = 60000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeout) {
    try {
      const page = await miniProgram.currentPage();
      if (page) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw lastError || new Error("Mini Program page did not become ready");
}

async function launchMiniProgram() {
  if (process.platform !== "win32") {
    return automator.launch({ projectPath: ROOT, cliPath: CLI_PATH, trustProject: true });
  }

  const endpoint = `ws://127.0.0.1:${AUTOMATION_PORT}`;
  try {
    return await automator.connect({ wsEndpoint: endpoint });
  } catch {
    const escapePowerShell = (value) => value.replaceAll("'", "''");
    const command = `& '${escapePowerShell(CLI_PATH)}' auto --project '${escapePowerShell(ROOT)}' --auto-port ${AUTOMATION_PORT} --trust-project`;
    const windowsPowerShell = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe"
    );
    spawn(windowsPowerShell, ["-NoProfile", "-NonInteractive", "-Command", command], {
      stdio: "ignore",
      windowsHide: true,
    });
    return connectWithRetry(endpoint);
  }
}

function compareImages(baselinePath, actualPath, diffPath) {
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const actual = PNG.sync.read(fs.readFileSync(actualPath));
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    return { ratio: 1, reason: "截图尺寸发生变化" };
  }
  const diff = new PNG({ width: actual.width, height: actual.height });
  const pixels = pixelmatch(baseline.data, actual.data, diff.data, actual.width, actual.height, {
    threshold: 0.15,
  });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  return { ratio: pixels / (actual.width * actual.height), reason: "" };
}

ensureDirectory(BASELINE_DIR);
ensureDirectory(ACTUAL_DIR);
ensureDirectory(DIFF_DIR);

let miniProgram;
let failed = false;
let savedAuth;
let authTemporarilyRemoved = false;

async function prepareLoggedOutState() {
  savedAuth = await miniProgram.callWxMethod("getStorageSync", "tomatoLedgerAuth");
  await miniProgram.callWxMethod("removeStorageSync", "tomatoLedgerAuth");
  await miniProgram.evaluate(() => {
    const app = getApp();
    app.globalData.loggedIn = false;
    app.globalData.user = null;
    app.globalData.openid = "";
    app.globalData.currentLedger = null;
  });
  authTemporarilyRemoved = true;
}

async function restoreAuthState() {
  if (!authTemporarilyRemoved) return;
  if (savedAuth) {
    await miniProgram.callWxMethod("setStorageSync", "tomatoLedgerAuth", savedAuth);
    await miniProgram.evaluate(() => getApp().restoreAuthState());
  }
  authTemporarilyRemoved = false;
}

try {
  miniProgram = await launchMiniProgram();
  await waitForReady(miniProgram);

  for (const testCase of CASES) {
    if (testCase.loggedOut) await prepareLoggedOutState();
    const page = await miniProgram.reLaunch(testCase.route);
    await page.waitFor(1000);
    const currentPage = await miniProgram.currentPage();
    const actualRoute = `/${currentPage.path}`;
    if (actualRoute !== testCase.route) {
      throw new Error(
        `${testCase.name}: expected route ${testCase.route}, but rendered ${actualRoute}`
      );
    }
    const actualPath = path.join(ACTUAL_DIR, `${testCase.name}.png`);
    const baselinePath = path.join(BASELINE_DIR, `${testCase.name}.png`);
    const diffPath = path.join(DIFF_DIR, `${testCase.name}.png`);
    await miniProgram.screenshot({ path: actualPath });

    if (UPDATE) {
      fs.copyFileSync(actualPath, baselinePath);
      console.log(`Updated visual baseline: ${testCase.name}`);
      if (testCase.loggedOut) await restoreAuthState();
      continue;
    }

    if (!fs.existsSync(baselinePath)) {
      failed = true;
      console.error(
        `${testCase.name}: visual baseline is missing; run npm run visual:update after review`
      );
      continue;
    }

    const result = compareImages(baselinePath, actualPath, diffPath);
    if (result.ratio > MAX_DIFF_RATIO) {
      failed = true;
      console.error(
        `${testCase.name}: visual diff ${(result.ratio * 100).toFixed(2)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(2)}%${result.reason ? ` (${result.reason})` : ""}`
      );
    } else {
      fs.rmSync(diffPath, { force: true });
      console.log(`${testCase.name}: visual diff ${(result.ratio * 100).toFixed(2)}%`);
    }
    if (testCase.loggedOut) await restoreAuthState();
  }
} finally {
  if (miniProgram) {
    await restoreAuthState();
    await miniProgram.close();
  }
}

if (failed) process.exit(1);
