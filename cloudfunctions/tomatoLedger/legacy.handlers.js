const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const defaultAvatarUrl = "/images/brand/tomato-ledger-logo-256-transparent.png";
const SCHEMA_VERSION = 1;

const defaultExpenseCategories = [
  ["餐饮", "#E94B35"],
  ["购物", "#FF7A59"],
  ["交通", "#4D8EE8"],
  ["住房", "#F3A23A"],
  ["水电", "#6F9CEB"],
  ["ͨѶ", "#7C6BE8"],
  ["医疗", "#45A86B"],
  ["育儿", "#F49AAB"],
  ["ѧϰ", "#5A9BD8"],
  ["娱乐", "#B06BE8"],
  ["人情", "#D99058"],
  ["旅行", "#2FA7A0"],
  ["其他", "#9B8B84"],
];

const defaultIncomeCategories = [
  ["工资", "#2F9D68"],
  ["奖金", "#5DBB82"],
  ["副业", "#4D8EE8"],
  ["红包", "#E94B35"],
  ["报销", "#F3A23A"],
  ["理财", "#7C6BE8"],
  ["其他", "#9B8B84"],
];

function ok(data = {}) {
  return { success: true, data };
}

function fail(message, code = "FAILED") {
  return { success: false, code, message };
}

function now() {
  return db.serverDate();
}

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
  for (let index = 0; index < 40; index += 1) {
    const token = makeCode("I", 18);
    const found = await db.collection("ledgerInvites").where({ token }).limit(1).get();
    if (!found.data.length) return token;
  }
  return `I${Date.now().toString(36).toUpperCase()}${makeCode("", 8)}`;
}
async function generateUniqueLedgerCode(field, options = {}) {
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

async function ensureCollections() {
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

async function getUser(openid) {
  const found = await db.collection("users").where({ openid }).limit(1).get();
  return found.data[0];
}

function isPlaceholderName(name) {
  return !name || name === "微信用户" || name === "番茄用户" || /^番茄用户#\d{4}$/.test(name);
}

function makeUserName(userNo) {
  return `番茄用户#${String(userNo).padStart(4, "0")}`;
}

async function generateUniqueUserNo() {
  for (let index = 0; index < 20; index += 1) {
    const userNo = Math.floor(1000 + Math.random() * 9000);
    const found = await db.collection("users").where({ userNo }).limit(1).get();
    if (!found.data.length) return userNo;
  }
  return Math.floor(1000 + Math.random() * 9000);
}

async function normalizeUserProfile(user) {
  let changed = false;
  const nextUser = { ...user };

  if (!nextUser.userNo) {
    nextUser.userNo = await generateUniqueUserNo();
    changed = true;
  }

  if (isPlaceholderName(nextUser.nickName)) {
    nextUser.nickName = makeUserName(nextUser.userNo);
    changed = true;
  }

  if (!nextUser.avatarUrl) {
    nextUser.avatarUrl = defaultAvatarUrl;
    changed = true;
  }

  if (!nextUser.gender) {
    nextUser.gender = "喵星人";
    changed = true;
  }

  if (changed && nextUser._id) {
    await db
      .collection("users")
      .doc(nextUser._id)
      .update({
        data: {
          userNo: nextUser.userNo,
          nickName: nextUser.nickName,
          avatarUrl: nextUser.avatarUrl,
          gender: nextUser.gender,
          updatedAt: now(),
        },
      });
  }

  return nextUser;
}

async function getLedgerById(ledgerId) {
  if (!ledgerId) return null;
  try {
    const ledgerRes = await db.collection("ledgers").doc(ledgerId).get();
    return ledgerRes.data || null;
  } catch (_error) {
    return null;
  }
}

async function getUserStats(openid) {
  const [records, ledgers] = await Promise.all([
    db.collection("records").where({ ownerOpenid: openid }).count(),
    db
      .collection("ledgers")
      .where(_.or([{ ownerOpenid: openid }, { memberOpenids: openid }, { viewerOpenids: openid }]))
      .count(),
  ]);
  return {
    recordCount: records.total || 0,
    ledgerCount: ledgers.total || 0,
  };
}

async function login(openid) {
  if (!openid) return fail("微信登录失败，请稍后重试", "OPENID_MISSING");

  const existed = await getUser(openid);
  if (existed) {
    let user = await normalizeUserProfile(existed);
    let currentLedger = await getLedgerById(user.currentLedgerId);
    let currentLedgerId = user.currentLedgerId || "";

    if (!currentLedger) {
      const ledgers = await listLedgersForUser(openid);
      currentLedger = ledgers[0] || null;
      currentLedgerId = currentLedger ? currentLedger._id : "";
      if (currentLedgerId !== user.currentLedgerId) {
        await db
          .collection("users")
          .doc(user._id)
          .update({ data: { currentLedgerId, updatedAt: now() } });
        user = { ...user, currentLedgerId };
      }
    }

    const stats = await getUserStats(openid);
    return ok({ openid, isNewUser: false, user, currentLedger, stats });
  }

  const userNo = await generateUniqueUserNo();
  const user = {
    openid,
    userNo,
    nickName: makeUserName(userNo),
    avatarUrl: defaultAvatarUrl,
    gender: "喵星人",
    currentLedgerId: "",
    createdAt: now(),
    updatedAt: now(),
  };
  const userRes = await db.collection("users").add({ data: user });

  return ok({
    openid,
    isNewUser: true,
    user: { ...user, _id: userRes._id },
    currentLedger: null,
    stats: { recordCount: 0, ledgerCount: 0 },
  });
}
async function updateProfile(openid, data = {}) {
  if (!openid) return fail("微信登录失败，请稍后重试", "OPENID_MISSING");
  const user = await getUser(openid);
  if (!user) return fail("请先登录", "LOGIN_REQUIRED");

  const nickName = String(data.nickName || "").trim();
  if (!nickName) return fail("请输入昵称", "INVALID_NICKNAME");
  if (nickName.length > 20) return fail("昵称最多 20 个字", "INVALID_NICKNAME");

  const systemNickName = makeUserName(user.userNo);
  if (/^番茄用户#\d{4}$/.test(nickName) && nickName !== systemNickName) {
    return fail("该昵称为系统编号格式，请换一个昵称", "RESERVED_NICKNAME");
  }

  const requestedAvatarUrl = String(data.avatarUrl || "");
  if (
    requestedAvatarUrl &&
    !requestedAvatarUrl.startsWith("cloud://") &&
    !requestedAvatarUrl.startsWith("/images/")
  ) {
    return fail("头像尚未上传至云端，请重新选择后保存", "AVATAR_NOT_PERSISTED");
  }

  const gender = data.gender || "喵星人";
  const allowedGenders = ["喵星人", "男生", "女生"];
  if (!allowedGenders.includes(gender)) return fail("请选择正确的性别", "INVALID_GENDER");

  const nextUser = {
    ...user,
    nickName,
    avatarUrl: requestedAvatarUrl || user.avatarUrl || defaultAvatarUrl,
    gender,
    updatedAt: now(),
  };

  await db
    .collection("users")
    .doc(user._id)
    .update({
      data: {
        nickName: nextUser.nickName,
        avatarUrl: nextUser.avatarUrl,
        gender: nextUser.gender,
        updatedAt: now(),
      },
    });

  return ok({ user: nextUser });
}

async function createDefaultCategories(ledgerId, openid) {
  return ensureLedgerCategoryTree(ledgerId, openid);
  const rows = [];
  defaultExpenseCategories.forEach(([name, color], index) => {
    rows.push({
      ledgerId,
      name,
      color,
      sort: index,
      type: "expense",
      isDefault: true,
      createdBy: openid,
      createdAt: now(),
    });
  });
  defaultIncomeCategories.forEach(([name, color], index) => {
    rows.push({
      ledgerId,
      name,
      color,
      sort: index,
      type: "income",
      isDefault: true,
      createdBy: openid,
      createdAt: now(),
    });
  });
  await Promise.all(rows.map((item) => db.collection("categories").add({ data: item })));
}

async function createLedger(openid, data = {}) {
  if (!openid) return fail("微信登录失败，请稍后重试", "OPENID_MISSING");

  const name = String(data.name || "").trim() || "我家账本";
  const budgetEnabled = Boolean(data.budgetEnabled);
  const requestedBudget = Number(data.monthlyBudget);
  const monthlyBudget =
    budgetEnabled && Number.isFinite(requestedBudget)
      ? Math.min(999999, Math.max(1, Math.round(requestedBudget * 100) / 100))
      : 0;
  if (Array.from(name).length < 1 || Array.from(name).length > 8)
    return fail("账本名称需为1-8个字符", "INVALID_LEDGER_NAME");

  const remark = String(data.remark || "").trim();
  if (remark.length > 80) return fail("账本备注最多 80 个字", "INVALID_LEDGER_REMARK");

  const type = data.type === "shared" ? "shared" : "personal";
  const [ledgerNo, inviteCode, readonlyShareCode] = await Promise.all([
    generateUniqueLedgerCode("ledgerNo", { prefix: "L", min: 7, max: 11 }),
    generateUniqueLedgerCode("inviteCode", { min: 6, max: 12 }),
    generateUniqueLedgerCode("readonlyShareCode", { prefix: "R", min: 6, max: 10 }),
  ]);

  const ledger = {
    ledgerNo,
    name,
    remark,
    type,
    ownerOpenid: openid,
    members: [{ openid, role: "owner", joinedAt: new Date() }],
    memberOpenids: [openid],
    viewers: [],
    viewerOpenids: [],
    inviteCode,
    readonlyShareCode,
    budgetEnabled,
    monthlyBudget,
    monthStartDay: 1,
    accounts: data.accounts || ["微信", "支付宝", "银行卡", "现金"],
    schemaVersion: SCHEMA_VERSION,
    createdAt: now(),
    updatedAt: now(),
  };
  const res = await db.collection("ledgers").add({ data: ledger });
  await createDefaultCategories(res._id, openid);
  await db
    .collection("users")
    .where({ openid })
    .update({ data: { currentLedgerId: res._id, updatedAt: now() } });
  return ok({ ledgerId: res._id, ledger: { ...ledger, _id: res._id } });
}

async function getLedgerForUser(openid, ledgerId) {
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

function assertRecordPayload(data = {}) {
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999)
    throw new Error("INVALID_RECORD_AMOUNT");
  if (!["income", "expense"].includes(data.type)) throw new Error("INVALID_RECORD_TYPE");
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error("INVALID_RECORD_DATE");
  if (Array.isArray(data.tags) && data.tags.length > 8) throw new Error("INVALID_RECORD_TAGS");
}

function assertLedgerId(ledgerId) {
  if (!String(ledgerId || "").trim()) throw new Error("LEDGER_ID_REQUIRED");
}

async function listLedgersForUser(openid) {
  const ledgers = await db
    .collection("ledgers")
    .where(_.or([{ ownerOpenid: openid }, { memberOpenids: openid }, { viewerOpenids: openid }]))
    .get();
  return ledgers.data || [];
}

async function getUsersByOpenids(openids = []) {
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

function attachRecordOwner(record = {}, ownerMap = {}, currentOpenid = "") {
  const owner = ownerMap[record.ownerOpenid] || {};
  return {
    ...record,
    id: record._id || record.id,
    memberName: owner.nickName || (record.ownerOpenid === currentOpenid ? "我" : "成员"),
    memberAvatar: owner.avatarUrl || defaultAvatarUrl,
  };
}

async function listLedgers(openid) {
  const ledgers = await listLedgersForUser(openid);
  return ok({ ledgers });
}

async function setCurrentLedger(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertReadable(role);
  const user = await getUser(openid);
  if (user && user._id) {
    await db
      .collection("users")
      .doc(user._id)
      .update({ data: { currentLedgerId: ledger._id, updatedAt: now() } });
  }
  return ok({ ledger, role });
}

async function createRecord(openid, data = {}) {
  assertRecordPayload(data);
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertWritable(role);

  const record = {
    ledgerId: ledger._id,
    ownerOpenid: openid,
    type: data.type,
    amount: Number(data.amount),
    categoryId: data.categoryId || "",
    categoryName: data.categoryName || "其他",
    categoryLabel: data.categoryLabel || data.categoryName || "其他",
    categoryIcon: data.categoryIcon || "price-tag-3-line",
    parentCategory: data.parentCategory || "",
    parentIcon: data.parentIcon || "",
    note: data.note || "",
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 8) : [],
    account: data.account || "微信",
    date: data.date || new Date().toISOString().slice(0, 10),
    time: data.time || "",
    schemaVersion: SCHEMA_VERSION,
    createdAt: now(),
    updatedAt: now(),
  };
  const res = await db.collection("records").add({ data: record });
  return ok({ recordId: res._id, record });
}

async function listRecords(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertReadable(role);
  const pageSize = Math.min(50, Math.max(1, Number(data.pageSize) || 30));
  const baseQuery = { ledgerId: ledger._id };
  if (data.type && data.type !== "all") baseQuery.type = data.type;
  if (data.start && data.end) baseQuery.date = _.gte(data.start).and(_.lt(data.end));
  const cursor = data.cursor && data.cursor.date && data.cursor.id ? data.cursor : null;
  const query = cursor
    ? _.and([
        baseQuery,
        _.or([{ date: _.lt(cursor.date) }, { date: cursor.date, _id: _.lt(cursor.id) }]),
      ])
    : baseQuery;
  const result = await db
    .collection("records")
    .where(query)
    .orderBy("date", "desc")
    .orderBy("_id", "desc")
    .limit(pageSize + 1)
    .get();
  const rows = result.data || [];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const ownerMap = await getUsersByOpenids(page.map((item) => item.ownerOpenid));
  const last = page[page.length - 1];
  return ok({
    records: page.map((item) => attachRecordOwner(item, ownerMap, openid)),
    nextCursor: hasMore && last ? { date: last.date, id: last._id } : null,
    hasMore,
    ledger: {
      _id: ledger._id,
      name: ledger.name,
      type: ledger.type || "personal",
      budgetEnabled: Boolean(ledger.budgetEnabled),
      monthlyBudget: Number(ledger.monthlyBudget || 0),
      monthStartDay: Number(ledger.monthStartDay || 1),
    },
    role,
    roleText: getRoleText(role),
    readonly: role === "readonly",
  });
}

async function getRecord(openid, data = {}) {
  const recordId = data.recordId || data.id;
  if (!recordId) return fail("记录不存在", "RECORD_NOT_FOUND");
  const recordRes = await db.collection("records").doc(recordId).get();
  const record = recordRes.data;
  if (!record) return fail("记录不存在", "RECORD_NOT_FOUND");
  const ledger = await getLedgerForUser(openid, record.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertReadable(role);
  const ownerMap = await getUsersByOpenids([record.ownerOpenid]);
  return ok({
    record: attachRecordOwner(record, ownerMap, openid),
    ledger: {
      _id: ledger._id,
      name: ledger.name,
      type: ledger.type || "personal",
    },
    role,
    roleText: getRoleText(role),
    readonly: role === "readonly",
  });
}

async function updateRecord(openid, data = {}) {
  assertRecordPayload(data);
  const recordRes = await db.collection("records").doc(data.recordId).get();
  const record = recordRes.data;
  const ledger = await getLedgerForUser(openid, record.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertWritable(role);
  if (role !== "owner" && record.ownerOpenid !== openid)
    throw new Error("ONLY_OWNER_CAN_EDIT_OTHERS");

  await db
    .collection("records")
    .doc(data.recordId)
    .update({
      data: {
        amount: Number(data.amount),
        categoryId: data.categoryId || record.categoryId,
        categoryName: data.categoryName || record.categoryName,
        categoryLabel:
          data.categoryLabel || record.categoryLabel || data.categoryName || record.categoryName,
        categoryIcon: data.categoryIcon || record.categoryIcon || "price-tag-3-line",
        parentCategory: data.parentCategory || record.parentCategory || "",
        parentIcon: data.parentIcon || record.parentIcon || "",
        note: data.note || "",
        tags: Array.isArray(data.tags) ? data.tags.slice(0, 8) : record.tags || [],
        account: data.account || record.account,
        date: data.date || record.date,
        time: data.time || record.time || "",
        updatedAt: now(),
      },
    });
  return ok();
}

async function deleteRecord(openid, data = {}) {
  const recordRes = await db.collection("records").doc(data.recordId).get();
  const record = recordRes.data;
  const ledger = await getLedgerForUser(openid, record.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertWritable(role);
  if (role !== "owner" && record.ownerOpenid !== openid)
    throw new Error("ONLY_OWNER_CAN_DELETE_OTHERS");

  await db.collection("records").doc(data.recordId).remove();
  return ok();
}

function makeDateText(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addMonth(year, month, delta) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function getCurrentMonthRange(monthStartDay = 1) {
  const startDay = Math.min(28, Math.max(1, Number(monthStartDay || 1)));
  const nowDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
  let year = nowDate.getUTCFullYear();
  let month = nowDate.getUTCMonth() + 1;
  const day = nowDate.getUTCDate();
  if (day < startDay) {
    const previous = addMonth(year, month, -1);
    year = previous.year;
    month = previous.month;
  }
  const next = addMonth(year, month, 1);
  const start = makeDateText(year, month, startDay);
  const end = makeDateText(next.year, next.month, startDay);
  return { year, month, start, end };
}

async function getDashboard(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  if (!ledger) return ok({ noLedger: true, monthRange: getCurrentMonthRange() });
  const role = getLedgerRole(openid, ledger);
  assertReadable(role);

  const monthStartDay = Number(ledger.monthStartDay || 1);
  const monthRange = getCurrentMonthRange(monthStartDay);
  const query = { ledgerId: ledger._id, date: _.gte(monthRange.start).and(_.lt(monthRange.end)) };
  const records = await db
    .collection("records")
    .where(query)
    .orderBy("date", "desc")
    .limit(100)
    .get();
  const monthRecords = (records.data || []).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  const ownerMap = await getUsersByOpenids(monthRecords.map((item) => item.ownerOpenid));
  const monthIncome = monthRecords
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const monthExpense = monthRecords
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const budgetEnabled = Boolean(ledger.budgetEnabled);
  const budget = budgetEnabled ? Number(ledger.monthlyBudget || 0) : 0;
  const budgetRate =
    budgetEnabled && budget ? Math.min(100, Math.round((monthExpense / budget) * 100)) : 0;
  const expenseMap = {};
  monthRecords.forEach((item) => {
    if (item.type !== "expense") return;
    const key = item.parentCategory || item.categoryName || "其他";
    expenseMap[key] = (expenseMap[key] || 0) + Number(item.amount || 0);
  });
  const topExpenseCategory =
    Object.keys(expenseMap).sort((a, b) => expenseMap[b] - expenseMap[a])[0] || "其他";
  const largestExpenseAmount = monthRecords
    .filter((item) => item.type === "expense")
    .reduce((max, item) => Math.max(max, Number(item.amount || 0)), 0);

  return ok({
    ledgerId: ledger._id,
    ledgerName: ledger.name,
    ledgerType: ledger.type || "personal",
    role,
    roleText: getRoleText(role),
    readonly: role === "readonly",
    monthIncome,
    monthExpense,
    balance: Number((monthIncome - monthExpense).toFixed(2)),
    budget,
    budgetEnabled,
    budgetLeft: budgetEnabled ? Number((budget - monthExpense).toFixed(2)) : 0,
    budgetRate,
    monthStartDay,
    recordCount: monthRecords.length,
    topExpenseCategory,
    largestExpenseAmount,
    familyMood: monthRecords.length ? "本月记录持续更新" : "本月还没有记录",
    monthRange,
    recentRecords: monthRecords
      .slice(0, 10)
      .map((item) => attachRecordOwner(item, ownerMap, openid)),
  });
}

async function updateBudget(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  if (role !== "owner") throw new Error("ONLY_OWNER_CAN_UPDATE_BUDGET");
  const budgetEnabled = Boolean(data.budgetEnabled);
  const requestedBudget = Number(data.monthlyBudget);
  if (
    budgetEnabled &&
    (!Number.isFinite(requestedBudget) || requestedBudget < 1 || requestedBudget > 999999)
  ) {
    return fail("预算金额需为 1-999999", "INVALID_MONTHLY_BUDGET");
  }
  const monthlyBudget =
    budgetEnabled && Number.isFinite(requestedBudget)
      ? Math.min(999999, Math.max(1, Math.round(requestedBudget * 100) / 100))
      : 0;
  await db
    .collection("ledgers")
    .doc(ledger._id)
    .update({ data: { budgetEnabled, monthlyBudget, updatedAt: now() } });
  return ok({ ledger: { ...ledger, budgetEnabled, monthlyBudget } });
}

async function updateMonthStartDay(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  if (role !== "owner") throw new Error("ONLY_OWNER_CAN_UPDATE_MONTH_START_DAY");
  const monthStartDay = Math.min(28, Math.max(1, Number(data.monthStartDay || 1)));
  await db
    .collection("ledgers")
    .doc(ledger._id)
    .update({ data: { monthStartDay, updatedAt: now() } });
  return ok({ ledger: { ...ledger, monthStartDay } });
}

async function createLedgerInviteToken(openid, data = {}) {
  if (!openid) return fail("请先登录", "LOGIN_REQUIRED");
  const ledger = await getLedgerById(data.ledgerId);
  if (!ledger) return fail("账本不存在", "LEDGER_NOT_FOUND");
  if (ledger.ownerOpenid !== openid) return fail("仅拥有者可邀请", "ONLY_OWNER_CAN_INVITE");

  const mode =
    ledger.type === "personal" ? "visitor" : data.mode === "member" ? "member" : "visitor";
  const token = await generateUniqueInviteToken();
  await db.collection("ledgerInvites").add({
    data: {
      token,
      ledgerId: ledger._id,
      mode,
      ownerOpenid: openid,
      claimedOpenid: "",
      createdAt: now(),
      updatedAt: now(),
    },
  });
  return ok({ token, mode });
}

async function joinLedgerByInviteToken(openid, data = {}) {
  if (!openid) return fail("LOGIN_REQUIRED", "LOGIN_REQUIRED");
  const token = String(data.inviteToken || "").trim();
  if (!token) return fail("INVALID_INVITE_TOKEN", "INVALID_INVITE_TOKEN");
  const found = await db.collection("ledgerInvites").where({ token }).limit(1).get();
  const invite = found.data[0];
  if (!invite) return fail("INVITE_NOT_FOUND", "INVITE_NOT_FOUND");
  const joined = await db.runTransaction(async (transaction) => {
    const currentInvite = (await transaction.collection("ledgerInvites").doc(invite._id).get())
      .data;
    if (!currentInvite || (currentInvite.claimedOpenid && currentInvite.claimedOpenid !== openid))
      throw new Error("INVITE_NOT_ALLOWED");
    const ledger = (await transaction.collection("ledgers").doc(currentInvite.ledgerId).get()).data;
    if (!ledger) throw new Error("LEDGER_NOT_FOUND");
    const role = getLedgerRole(openid, ledger);
    if (role !== "none") {
      if (!currentInvite.claimedOpenid)
        await transaction
          .collection("ledgerInvites")
          .doc(currentInvite._id)
          .update({ data: { claimedOpenid: openid, updatedAt: now() } });
      return { ledger, role, already: true };
    }
    const nextRole =
      currentInvite.mode === "member" && ledger.type === "shared" ? "member" : "readonly";
    const ledgerPatch =
      nextRole === "member"
        ? {
            members: _.push([{ openid, role: "member", joinedAt: new Date() }]),
            memberOpenids: _.push([openid]),
            updatedAt: now(),
          }
        : {
            viewers: _.push([{ openid, joinedAt: new Date() }]),
            viewerOpenids: _.push([openid]),
            updatedAt: now(),
          };
    await transaction.collection("ledgers").doc(ledger._id).update({ data: ledgerPatch });
    await transaction
      .collection("ledgerInvites")
      .doc(currentInvite._id)
      .update({ data: { claimedOpenid: openid, updatedAt: now() } });
    return { ledger, role: nextRole, already: false };
  });
  return ok({
    ledgerId: joined.ledger._id,
    ledger: joined.ledger,
    role: joined.role,
    already: joined.already,
  });
}
async function joinLedger(openid, data = {}) {
  const found = await db
    .collection("ledgers")
    .where({ inviteCode: data.inviteCode })
    .limit(1)
    .get();
  const ledger = found.data[0];
  if (!ledger) return fail("邀请码无效", "INVALID_INVITE_CODE");
  if ((ledger.memberOpenids || []).includes(openid)) return ok({ ledgerId: ledger._id, ledger });
  await db
    .collection("ledgers")
    .doc(ledger._id)
    .update({
      data: {
        members: _.push([{ openid, role: "member", joinedAt: new Date() }]),
        memberOpenids: _.push([openid]),
        updatedAt: now(),
      },
    });
  return ok({ ledgerId: ledger._id, ledger });
}

async function joinReadonlyLedger(openid, data = {}) {
  const found = await db
    .collection("ledgers")
    .where({ readonlyShareCode: data.readonlyShareCode })
    .limit(1)
    .get();
  const ledger = found.data[0];
  if (!ledger) return fail("访客分享码无效", "INVALID_READONLY_CODE");
  if ((ledger.viewerOpenids || []).includes(openid)) return ok({ ledgerId: ledger._id, ledger });
  await db
    .collection("ledgers")
    .doc(ledger._id)
    .update({
      data: {
        viewers: _.push([{ openid, joinedAt: new Date() }]),
        viewerOpenids: _.push([openid]),
        updatedAt: now(),
      },
    });
  return ok({ ledgerId: ledger._id, ledger });
}

async function getOperation(type, key) {
  const result = await db.collection("ledgerOperations").where({ type, key }).limit(1).get();
  return result.data[0] || null;
}

async function saveOperation(operation, patch) {
  const data = { ...patch, updatedAt: now() };
  if (operation && operation._id) {
    await db.collection("ledgerOperations").doc(operation._id).update({ data });
    return { ...operation, ...data };
  }
  const created = { ...data, createdAt: now() };
  const result = await db.collection("ledgerOperations").add({ data: created });
  return { _id: result._id, ...created };
}

async function runLedgerDeletion(openid, ledgerId) {
  const key = "delete:" + ledgerId;
  let operation = await getOperation("ledger-delete", key);
  let ledger = await getLedgerById(ledgerId);
  if (!operation) {
    if (!ledger) throw new Error("LEDGER_NOT_FOUND");
    if (ledger.ownerOpenid !== openid) throw new Error("ONLY_OWNER_CAN_DELETE_LEDGER");
    operation = await saveOperation(null, {
      type: "ledger-delete",
      key,
      ledgerId,
      ownerOpenid: openid,
      stage: "records",
      status: "running",
    });
  } else if (operation.ownerOpenid !== openid) {
    throw new Error("ONLY_OWNER_CAN_DELETE_LEDGER");
  }
  if (operation.stage === "records")
    operation = await saveOperation(operation, {
      stage: "categories",
      deletedRecords: await deleteByQuery("records", { ledgerId }),
    });
  if (operation.stage === "categories")
    operation = await saveOperation(operation, {
      stage: "ledger",
      deletedCategories: await deleteByQuery("categories", { ledgerId }),
    });
  if (operation.stage === "ledger") {
    ledger = ledger || (await getLedgerById(ledgerId));
    if (ledger) await db.collection("ledgers").doc(ledgerId).remove();
    operation = await saveOperation(operation, {
      stage: "complete",
      status: "complete",
      completedAt: now(),
    });
  }
  const user = await getUser(openid);
  let currentLedger = null;
  let currentLedgerId = user && user.currentLedgerId !== ledgerId ? user.currentLedgerId || "" : "";
  if (user && user.currentLedgerId === ledgerId) {
    const rest = await listLedgersForUser(openid);
    currentLedger = rest[0] || null;
    currentLedgerId = currentLedger ? currentLedger._id : "";
    await db
      .collection("users")
      .doc(user._id)
      .update({ data: { currentLedgerId, updatedAt: now() } });
  } else if (currentLedgerId) currentLedger = await getLedgerById(currentLedgerId);
  return { currentLedgerId, currentLedger, operationId: operation._id };
}

async function deleteLedger(openid, data = {}) {
  assertLedgerId(data.ledgerId);
  if (!openid) return fail("LOGIN_REQUIRED", "OPENID_MISSING");
  return ok(await runLedgerDeletion(openid, data.ledgerId));
}
async function deleteByQuery(collectionName, query) {
  let deleted = 0;
  while (true) {
    const result = await db.collection(collectionName).where(query).limit(100).get();
    const rows = result.data || [];
    if (!rows.length) break;
    await Promise.all(rows.map((item) => db.collection(collectionName).doc(item._id).remove()));
    deleted += rows.length;
  }
  return deleted;
}

async function clearCollection(collectionName) {
  let deleted = 0;
  while (true) {
    const result = await db.collection(collectionName).where({}).remove();
    const removed = (result.stats && result.stats.removed) || result.deleted || 0;
    deleted += removed;
    if (!removed) break;
  }
  return deleted;
}

async function resetDatabase(openid, data = {}) {
  if (!openid)
    return fail(
      "\u5fae\u4fe1\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
      "OPENID_MISSING"
    );
  if (data.confirm !== "RESET_TOMATO_LEDGER_DATABASE") {
    return fail("\u7f3a\u5c11\u6570\u636e\u5e93\u91cd\u7f6e\u786e\u8ba4", "RESET_CONFIRM_REQUIRED");
  }

  const collections = ["records", "categories", "ledgers", "ledgerInvites"];
  const entries = await Promise.all(
    collections.map(async (name) => [name, await clearCollection(name)])
  );
  const deleted = entries.reduce((result, [name, count]) => {
    result[name] = count;
    return result;
  }, {});
  return ok({ deleted });
}
const categoryTreeDefaults = {
  expense: [
    [
      "\u9910\u996e",
      "restaurant-2-line",
      ["\u65e9\u9910", "\u5348\u9910", "\u665a\u9910", "\u4e70\u83dc", "\u5496\u5561\u5976\u8336"],
    ],
    [
      "\u8d2d\u7269",
      "shopping-bag-3-line",
      [
        "\u65e5\u7528\u54c1",
        "\u670d\u9970\u978b\u5305",
        "\u6570\u7801\u7535\u5668",
        "\u7f8e\u5986\u4e2a\u62a4",
      ],
    ],
    [
      "\u4ea4\u901a",
      "taxi-line",
      ["\u516c\u4ea4\u5730\u94c1", "\u6253\u8f66", "\u52a0\u6cb9\u5145\u7535", "\u505c\u8f66"],
    ],
    [
      "\u5c45\u5bb6",
      "home-4-line",
      ["\u623f\u79df\u623f\u8d37", "\u6c34\u7535\u71c3\u6c14", "\u7269\u4e1a", "\u7ef4\u4fee"],
    ],
    [
      "\u751f\u6d3b",
      "heart-pulse-line",
      ["\u533b\u7597", "\u5b66\u4e60", "\u5a31\u4e50", "\u65c5\u884c"],
    ],
    ["\u5176\u4ed6", "more-2-line", ["\u5176\u4ed6\u652f\u51fa"]],
  ],
  income: [
    [
      "\u5de5\u4f5c\u6536\u5165",
      "wallet-3-line",
      ["\u5de5\u8d44", "\u5956\u91d1", "\u52a0\u73ed", "\u62a5\u9500"],
    ],
    [
      "\u526f\u4e1a\u6536\u5165",
      "briefcase-4-line",
      ["\u526f\u4e1a", "\u9879\u76ee", "\u7a3f\u8d39", "\u54a8\u8be2"],
    ],
    [
      "\u8d44\u4ea7\u6536\u5165",
      "funds-line",
      ["\u7406\u8d22", "\u5229\u606f", "\u5206\u7ea2", "\u623f\u79df"],
    ],
    [
      "\u5176\u4ed6",
      "more-2-line",
      ["\u7ea2\u5305", "\u9000\u6b3e", "\u793c\u91d1", "\u5176\u4ed6\u6536\u5165"],
    ],
  ],
};
async function addDefaultChild(ledgerId, parent, openid) {
  const existing = await db
    .collection("categories")
    .where({ ledgerId, level: "child", parentId: parent._id, isDefaultChild: true })
    .limit(1)
    .get();
  if (existing.data.length) return existing.data[0];
  const res = await db.collection("categories").add({
    data: {
      ledgerId,
      type: parent.type,
      level: "child",
      parentId: parent._id,
      parentName: parent.name,
      name: parent.name,
      icon: parent.icon || "price-tag-3-line",
      sort: -1,
      isDefaultChild: true,
      createdBy: openid,
      createdAt: now(),
      updatedAt: now(),
    },
  });
  return {
    _id: res._id,
    ledgerId,
    type: parent.type,
    level: "child",
    parentId: parent._id,
    parentName: parent.name,
    name: parent.name,
    icon: parent.icon || "price-tag-3-line",
    isDefaultChild: true,
  };
}
async function ensureLedgerCategoryTree(ledgerId, openid) {
  const parentResult = await db
    .collection("categories")
    .where({ ledgerId, level: "parent" })
    .limit(200)
    .get();
  if (parentResult.data.length) {
    await Promise.all(parentResult.data.map((parent) => addDefaultChild(ledgerId, parent, openid)));
    return;
  }
  for (const type of ["expense", "income"])
    for (let index = 0; index < categoryTreeDefaults[type].length; index += 1) {
      const [name, icon, children] = categoryTreeDefaults[type][index];
      const parentRes = await db.collection("categories").add({
        data: {
          ledgerId,
          type,
          level: "parent",
          name,
          icon,
          sort: index,
          isOther: name === "\u5176\u4ed6",
          createdBy: openid,
          createdAt: now(),
          updatedAt: now(),
        },
      });
      const parent = { _id: parentRes._id, ledgerId, type, name, icon };
      await addDefaultChild(ledgerId, parent, openid);
      await Promise.all(
        children.map((childName, childIndex) =>
          db.collection("categories").add({
            data: {
              ledgerId,
              type,
              level: "child",
              parentId: parentRes._id,
              parentName: name,
              name: childName,
              icon,
              sort: childIndex,
              isDefaultChild: false,
              createdBy: openid,
              createdAt: now(),
              updatedAt: now(),
            },
          })
        )
      );
    }
}
async function listCategories(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertReadable(role);
  await ensureLedgerCategoryTree(ledger._id, ledger.ownerOpenid);
  const result = await db
    .collection("categories")
    .where({ ledgerId: ledger._id })
    .orderBy("sort", "asc")
    .limit(200)
    .get();
  return ok({ categories: result.data || [], role });
}
async function saveCategory(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  const editing = Boolean(data.categoryId);
  if (editing && role !== "owner") throw new Error("ONLY_OWNER_CAN_EDIT_CATEGORY");
  if (!editing && !["owner", "member"].includes(role)) throw new Error("NO_CATEGORY_PERMISSION");
  const name = Array.from(String(data.name || "").trim())
    .slice(0, 6)
    .join("");
  if (!name) throw new Error("INVALID_CATEGORY_NAME");
  if (editing) {
    const category = (await db.collection("categories").doc(data.categoryId).get()).data;
    if (!category || category.ledgerId !== ledger._id) throw new Error("CATEGORY_NOT_FOUND");
    if (category.isOther && category.level === "parent" && name !== "\u5176\u4ed6")
      throw new Error("OTHER_CATEGORY_NAME_LOCKED");
    await db
      .collection("categories")
      .doc(category._id)
      .update({ data: { name, icon: data.icon || category.icon, updatedAt: now() } });
    if (category.level === "parent")
      await db
        .collection("categories")
        .where({ ledgerId: ledger._id, parentId: category._id })
        .update({ data: { parentName: name, updatedAt: now() } });
    return ok();
  }
  const level = data.level === "parent" ? "parent" : "child";
  if (level === "child" && !data.parentId) throw new Error("PARENT_REQUIRED");
  const parent =
    level === "child" ? (await db.collection("categories").doc(data.parentId).get()).data : null;
  if (parent && (parent.ledgerId !== ledger._id || parent.level !== "parent"))
    throw new Error("PARENT_NOT_FOUND");
  const type = data.type === "income" ? "income" : "expense";
  const icon = data.icon || "price-tag-3-line";
  const addResult = await db.collection("categories").add({
    data: {
      ledgerId: ledger._id,
      type,
      level,
      parentId: parent ? parent._id : "",
      parentName: parent ? parent.name : "",
      name,
      icon,
      sort: Date.now(),
      isOther: false,
      isDefaultChild: false,
      createdBy: openid,
      createdAt: now(),
      updatedAt: now(),
    },
  });
  if (level === "parent")
    await addDefaultChild(ledger._id, { _id: addResult._id, type, name, icon }, openid);
  return ok();
}
async function getOtherDefaultChild(ledger, type, openid) {
  const other = (
    await db
      .collection("categories")
      .where({ ledgerId: ledger._id, type, level: "parent", isOther: true })
      .limit(1)
      .get()
  ).data[0];
  if (!other) throw new Error("OTHER_CATEGORY_NOT_FOUND");
  return { parent: other, child: await addDefaultChild(ledger._id, other, openid) };
}
async function migrateTo(ledger, fromParentName, fromChild, target) {
  const query = { ledgerId: ledger._id, parentCategory: fromParentName };
  if (fromChild) query.categoryName = fromChild.name;
  await db
    .collection("records")
    .where(query)
    .update({
      data: {
        parentCategory: target.parent.name,
        parentIcon: target.parent.icon || "more-2-line",
        categoryId: target.child._id,
        categoryName: target.child.name,
        categoryLabel: target.child.name,
        categoryIcon: target.child.icon || target.parent.icon || "price-tag-3-line",
        updatedAt: now(),
      },
    });
}
async function removeParentAndMigrate(ledger, parent, openid) {
  if (parent.isOther) throw new Error("OTHER_CATEGORY_CANNOT_DELETE");
  const target = await getOtherDefaultChild(ledger, parent.type, openid);
  await migrateTo(ledger, parent.name, null, target);
  await db.collection("categories").where({ ledgerId: ledger._id, parentId: parent._id }).remove();
  await db.collection("categories").doc(parent._id).remove();
}
async function removeCategory(openid, data = {}) {
  assertLedgerId(data.ledgerId);
  if (!data.categoryId) throw new Error("CATEGORY_ID_REQUIRED");
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  if (getLedgerRole(openid, ledger) !== "owner") throw new Error("ONLY_OWNER_CAN_DELETE_CATEGORY");
  const category = (await db.collection("categories").doc(data.categoryId).get()).data;
  if (!category || category.ledgerId !== ledger._id) throw new Error("CATEGORY_NOT_FOUND");
  const key = "category-delete:" + category._id;
  let operation = await getOperation("category-delete", key);
  if (!operation)
    operation = await saveOperation(null, {
      type: "category-delete",
      key,
      ledgerId: ledger._id,
      categoryId: category._id,
      stage: "migrate",
      status: "running",
    });
  if (operation.stage === "migrate") {
    if (category.level === "parent") await removeParentAndMigrate(ledger, category, openid);
    else {
      const parent = (await db.collection("categories").doc(category.parentId).get()).data;
      if (!parent) throw new Error("PARENT_NOT_FOUND");
      const target = await getOtherDefaultChild(ledger, parent.type, openid);
      await migrateTo(ledger, parent.name, category, target);
      await db.collection("categories").doc(category._id).remove();
    }
    operation = await saveOperation(operation, {
      stage: "complete",
      status: "complete",
      completedAt: now(),
    });
  }
  return ok({ operationId: operation._id });
}

async function execute(operation, openid, payload = {}) {
  await ensureCollections();
  const handlers = {
    login,
    resetDatabase,
    updateProfile,
    createLedger,
    listLedgers,
    listCategories,
    saveCategory,
    removeCategory,
    setCurrentLedger,
    deleteLedger,
    createRecord,
    getRecord,
    listRecords,
    updateRecord,
    deleteRecord,
    getDashboard,
    updateBudget,
    updateMonthStartDay,
    createLedgerInviteToken,
    joinLedgerByInviteToken,
    joinLedger,
    joinReadonlyLedger,
  };
  const handler = handlers[operation];
  if (!handler) return fail(`Unknown route: ${operation}`, "ROUTE_NOT_FOUND");
  return handler(openid, payload);
}

module.exports = { execute };
