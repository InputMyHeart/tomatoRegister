const cloud = require("wx-server-sdk");

// --- 云数据库 singleton（cloud.init 全局只执行一次） ---
let _db;
let _command;
let _aggregate;

function getDb() {
  if (!_db) {
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    _db = cloud.database();
    _command = _db.command;
    _aggregate = _db.command.aggregate;
  }
  return { db: _db, _: _command, $: _aggregate };
}

Object.defineProperty(module.exports, "db", {
  get() {
    return getDb().db;
  },
});
Object.defineProperty(module.exports, "_", {
  get() {
    return getDb()._;
  },
});
Object.defineProperty(module.exports, "$", {
  get() {
    return getDb().$;
  },
});

// --- 常量 ---
const defaultAvatarUrl = "/images/brand/tomato-ledger-logo-256-transparent.png";
const SCHEMA_VERSION = 1;
const OTHER_CATEGORY_SORT = 9999999999999;
const defaultQuickAmounts = [18, 32, 68, 128];
const defaultPaymentAccounts = ["微信", "支付宝", "银行卡", "信用卡", "现金"];

// --- 响应工具 ---
function ok(data = {}) {
  return { success: true, data };
}

function fail(message, code = "FAILED") {
  return { success: false, code, message };
}

function now() {
  return getDb().db.serverDate();
}

// --- 同步辅助 ---
async function bumpLedgerSyncRevision(ledgerId) {
  if (!ledgerId) return;
  const { db, _ } = getDb();
  try {
    await db
      .collection("ledgers")
      .doc(ledgerId)
      .update({ data: { syncRevision: _.inc(1), updatedAt: now() } });
  } catch (error) {
    console.error("failed to bump ledger sync revision", ledgerId, error);
  }
}

// --- 编码生成 ---
function makeCode(prefix = "", length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = prefix;
  for (let index = 0; index < length; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function randomLength(min = 6, max = 12) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

async function generateUniqueInviteToken() {
  const { db } = getDb();
  for (let index = 0; index < 40; index += 1) {
    const token = makeCode("I", 18);
    const found = await db.collection("ledgerInvites").where({ token }).limit(1).get();
    if (!found.data.length) return token;
  }
  return `I${Date.now().toString(36).toUpperCase()}${makeCode("", 8)}`;
}

async function generateUniqueLedgerCode(field, options = {}) {
  const { db } = getDb();
  const { prefix = "", min = 6, max = 12, attempts = 40 } = options;
  for (let index = 0; index < attempts; index += 1) {
    const code = makeCode(prefix, randomLength(min, max));
    const found = await db
      .collection("ledgers")
      .where({ [field]: code })
      .limit(1)
      .get();
    if (!found.data.length) return code;
  }
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

// --- 集合初始化 ---
async function ensureCollections() {
  const { db } = getDb();
  const names = ["users", "ledgers", "categories", "records", "ledgerInvites", "ledgerOperations"];
  await Promise.all(
    names.map(async (name) => {
      try {
        await db.createCollection(name);
      } catch (error) {
        const message = error && (error.errMsg || error.message || "");
        if (!message.includes("exist") && !message.includes("already")) {
          console.warn(`ensure collection ${name} skipped`, error);
        }
      }
    })
  );
}

// --- 读取工具 ---
async function getUser(openid) {
  const { db } = getDb();
  const found = await db.collection("users").where({ openid }).limit(1).get();
  return found.data[0];
}

async function getLedgerById(ledgerId) {
  if (!ledgerId) return null;
  const { db } = getDb();
  try {
    const ledgerRes = await db.collection("ledgers").doc(ledgerId).get();
    return ledgerRes.data || null;
  } catch (_error) {
    return null;
  }
}

async function listLedgersForUser(openid) {
  const { db, _ } = getDb();
  const ledgers = await db
    .collection("ledgers")
    .where(_.or([{ ownerOpenid: openid }, { memberOpenids: openid }, { viewerOpenids: openid }]))
    .get();
  return ledgers.data || [];
}

// --- 跨域读取 ---

// --- 日期辅助 ---
function makeDateText(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addMonth(year, month, delta) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function getCurrentMonthRange() {
  const nowDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const year = nowDate.getUTCFullYear();
  const month = nowDate.getUTCMonth() + 1;
  const next = addMonth(year, month, 1);
  return {
    year,
    month,
    day: nowDate.getUTCDate(),
    start: makeDateText(year, month, 1),
    end: makeDateText(next.year, next.month, 1),
  };
}

// --- 跨域读取 ---
async function getLedgerForUser(openid, ledgerId) {
  const { db } = getDb();
  if (ledgerId) {
    const ledgerRes = await db.collection("ledgers").doc(ledgerId).get();
    return ledgerRes.data;
  }

  const user = await getUser(openid);
  if (user && user.currentLedgerId) {
    const ledgerRes = await db.collection("ledgers").doc(user.currentLedgerId).get();
    return ledgerRes.data;
  }

  const list = await db.collection("ledgers").where({ memberOpenids: openid }).limit(1).get();
  return list.data[0];
}

async function getUsersByOpenids(openids = []) {
  const { db, _ } = getDb();
  const uniqueOpenids = Array.from(new Set(openids.filter(Boolean)));
  if (!uniqueOpenids.length) return {};
  const result = await db
    .collection("users")
    .where({ openid: _.in(uniqueOpenids) })
    .get();
  return (result.data || []).reduce((map, user) => {
    map[user.openid] = user;
    return map;
  }, {});
}

async function resolveUsersAvatarUrls(users = {}) {
  const fileIds = Array.from(
    new Set(
      Object.values(users)
        .map((user) => user && user.avatarUrl)
        .filter((avatarUrl) => typeof avatarUrl === "string" && avatarUrl.startsWith("cloud://"))
    )
  );
  if (!fileIds.length) return users;

  try {
    const result = await cloud.getTempFileURL({ fileList: fileIds });
    const urlMap = (result.fileList || []).reduce((map, item) => {
      if (item.fileID && item.tempFileURL) map[item.fileID] = item.tempFileURL;
      return map;
    }, {});
    return Object.keys(users).reduce((map, openid) => {
      const user = users[openid];
      map[openid] = {
        ...user,
        avatarUrl: urlMap[user.avatarUrl] || defaultAvatarUrl,
      };
      return map;
    }, {});
  } catch (error) {
    console.warn("resolve users avatar URLs failed", error);
    return users;
  }
}

async function getRecordById(id) {
  if (!id) return null;
  const { db } = getDb();
  const res = await db.collection("records").doc(id).get();
  return res.data || null;
}

async function getCategoryById(id) {
  if (!id) return null;
  const { db } = getDb();
  const res = await db.collection("categories").doc(id).get();
  return res.data || null;
}

async function getLedgerInviteByToken(token) {
  if (!token) return null;
  const { db } = getDb();
  const res = await db.collection("ledgerInvites").where({ token }).limit(1).get();
  return res.data[0] || null;
}

// --- 可恢复操作日志（账本删除 / 分类迁移共用） ---
async function getOperation(type, key) {
  const { db } = getDb();
  const result = await db.collection("ledgerOperations").where({ type, key }).limit(1).get();
  return result.data[0] || null;
}

async function saveOperation(operation, patch) {
  const { db } = getDb();
  const data = { ...patch, updatedAt: now() };
  if (operation && operation._id) {
    await db.collection("ledgerOperations").doc(operation._id).update({ data });
    return { ...operation, ...data };
  }
  const created = { ...data, createdAt: now() };
  const result = await db.collection("ledgerOperations").add({ data: created });
  return { _id: result._id, ...created };
}

// --- 角色 & 权限工具 ---
function getLedgerRole(openid, ledger) {
  if (!ledger) return "none";
  if (ledger.ownerOpenid === openid) return "owner";
  if ((ledger.memberOpenids || []).includes(openid)) return "member";
  if ((ledger.viewerOpenids || []).includes(openid)) return "readonly";
  return "none";
}

function getRoleText(role) {
  if (role === "owner") return "拥有者";
  if (role === "member") return "成员";
  return "访客";
}

function assertReadable(role) {
  if (!["owner", "member", "readonly"].includes(role)) throw new Error("NO_LEDGER_ACCESS");
}

function assertWritable(role) {
  if (!["owner", "member"].includes(role)) throw new Error("READONLY_LEDGER");
}

function assertLedgerId(ledgerId) {
  if (!String(ledgerId || "").trim()) throw new Error("LEDGER_ID_REQUIRED");
}

// --- 导出 ---
Object.assign(module.exports, {
  // cloud primitives
  getDb,
  // constants
  defaultAvatarUrl,
  SCHEMA_VERSION,
  OTHER_CATEGORY_SORT,
  defaultQuickAmounts,
  defaultPaymentAccounts,
  // response
  ok,
  fail,
  now,
  // helpers
  bumpLedgerSyncRevision,
  makeCode,
  randomLength,
  generateUniqueInviteToken,
  generateUniqueLedgerCode,
  ensureCollections,
  // queries
  getUser,
  getLedgerById,
  listLedgersForUser,
  getLedgerForUser,
  getUsersByOpenids,
  resolveUsersAvatarUrls,
  getRecordById,
  getCategoryById,
  getLedgerInviteByToken,
  // resumable operations
  getOperation,
  saveOperation,
  // date helpers
  makeDateText,
  addMonth,
  getCurrentMonthRange,
  // role & authz
  getLedgerRole,
  getRoleText,
  assertReadable,
  assertWritable,
  assertLedgerId,
});
