const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const defaultAvatarUrl = "/images/brand/tomato-ledger-logo-256-transparent.png";

const defaultExpenseCategories = [
  ["餐饮", "#E94B35"],
  ["购物", "#FF7A59"],
  ["交通", "#4D8EE8"],
  ["住房", "#F3A23A"],
  ["水电", "#6F9CEB"],
  ["通讯", "#7C6BE8"],
  ["医疗", "#45A86B"],
  ["育儿", "#F49AAB"],
  ["学习", "#5A9BD8"],
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
    const found = await db.collection("ledgers").where({ [field]: code }).limit(1).get();
    if (!found.data.length) return code;
  }
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

async function ensureCollections() {
  const names = ["users", "ledgers", "categories", "records", "ledgerInvites"];
  await Promise.all(names.map(async (name) => {
    try {
      await db.createCollection(name);
    } catch (error) {
      const message = error && (error.errMsg || error.message || "");
      if (!message.includes("exist") && !message.includes("already")) {
        console.warn(`ensure collection ${name} skipped`, error);
      }
    }
  }));
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
    await db.collection("users").doc(nextUser._id).update({
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
  } catch (error) {
    return null;
  }
}

async function getUserStats(openid) {
  const [records, ledgers] = await Promise.all([
    db.collection("records").where({ ownerOpenid: openid }).count(),
    db.collection("ledgers").where(_.or([
      { ownerOpenid: openid },
      { memberOpenids: openid },
      { viewerOpenids: openid },
    ])).count(),
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
        await db.collection("users").doc(user._id).update({ data: { currentLedgerId, updatedAt: now() } });
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

  const gender = data.gender || "喵星人";
  const allowedGenders = ["喵星人", "男生", "女生"];
  if (!allowedGenders.includes(gender)) return fail("请选择正确的性别", "INVALID_GENDER");

  const nextUser = {
    ...user,
    nickName,
    avatarUrl: data.avatarUrl || user.avatarUrl || defaultAvatarUrl,
    gender,
    updatedAt: now(),
  };

  await db.collection("users").doc(user._id).update({
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
  const rows = [];
  defaultExpenseCategories.forEach(([name, color], index) => {
    rows.push({ ledgerId, name, color, sort: index, type: "expense", isDefault: true, createdBy: openid, createdAt: now() });
  });
  defaultIncomeCategories.forEach(([name, color], index) => {
    rows.push({ ledgerId, name, color, sort: index, type: "income", isDefault: true, createdBy: openid, createdAt: now() });
  });
  await Promise.all(rows.map((item) => db.collection("categories").add({ data: item })));
}

async function createLedger(openid, data = {}) {
  if (!openid) return fail("微信登录失败，请稍后重试", "OPENID_MISSING");

  const name = String(data.name || "").trim() || "我家账本";
  if (Array.from(name).length < 1 || Array.from(name).length > 8) return fail("账本名称需为1-8个字符", "INVALID_LEDGER_NAME");

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
    budgetEnabled: false,
    monthlyBudget: Number(data.monthlyBudget || 0),
    monthStartDay: 1,
    accounts: data.accounts || ["微信", "支付宝", "银行卡", "现金"],
    createdAt: now(),
    updatedAt: now(),
  };
  const res = await db.collection("ledgers").add({ data: ledger });
  await createDefaultCategories(res._id, openid);
  await db.collection("users").where({ openid }).update({ data: { currentLedgerId: res._id, updatedAt: now() } });
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

async function listLedgersForUser(openid) {
  const ledgers = await db.collection("ledgers").where(_.or([
    { ownerOpenid: openid },
    { memberOpenids: openid },
    { viewerOpenids: openid },
  ])).get();
  return ledgers.data || [];
}

async function getUsersByOpenids(openids = []) {
  const uniqueOpenids = Array.from(new Set(openids.filter(Boolean)));
  if (!uniqueOpenids.length) return {};
  const result = await db.collection("users").where({ openid: _.in(uniqueOpenids) }).get();
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
    await db.collection("users").doc(user._id).update({ data: { currentLedgerId: ledger._id, updatedAt: now() } });
  }
  return ok({ ledger, role });
}

async function createRecord(openid, data = {}) {
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

  const query = { ledgerId: ledger._id };
  if (data.type && data.type !== "all") query.type = data.type;
  if (data.start && data.end) query.date = _.gte(data.start).and(_.lt(data.end));
  const result = await db.collection("records").where(query).orderBy("date", "desc").orderBy("time", "desc").limit(100).get();
  const records = result.data || [];
  const ownerMap = await getUsersByOpenids(records.map((item) => item.ownerOpenid));
  return ok({
    records: records.map((item) => attachRecordOwner(item, ownerMap, openid)),
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
  const recordRes = await db.collection("records").doc(data.recordId).get();
  const record = recordRes.data;
  const ledger = await getLedgerForUser(openid, record.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertWritable(role);
  if (role !== "owner" && record.ownerOpenid !== openid) throw new Error("ONLY_OWNER_CAN_EDIT_OTHERS");

  await db.collection("records").doc(data.recordId).update({
    data: {
      amount: Number(data.amount),
      categoryId: data.categoryId || record.categoryId,
      categoryName: data.categoryName || record.categoryName,
      categoryLabel: data.categoryLabel || record.categoryLabel || data.categoryName || record.categoryName,
      categoryIcon: data.categoryIcon || record.categoryIcon || "price-tag-3-line",
      parentCategory: data.parentCategory || record.parentCategory || "",
      parentIcon: data.parentIcon || record.parentIcon || "",
      note: data.note || "",
      tags: Array.isArray(data.tags) ? data.tags.slice(0, 8) : (record.tags || []),
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
  if (role !== "owner" && record.ownerOpenid !== openid) throw new Error("ONLY_OWNER_CAN_DELETE_OTHERS");

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
  const records = await db.collection("records").where(query).orderBy("date", "desc").limit(10).get();
  const monthRecords = records.data || [];
  const ownerMap = await getUsersByOpenids(monthRecords.map((item) => item.ownerOpenid));
  const monthIncome = monthRecords.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const monthExpense = monthRecords.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const budgetEnabled = Boolean(ledger.budgetEnabled);
  const budget = budgetEnabled ? Number(ledger.monthlyBudget || 0) : 0;
  const budgetRate = budgetEnabled && budget ? Math.min(100, Math.round((monthExpense / budget) * 100)) : 0;
  const expenseMap = {};
  monthRecords.forEach((item) => {
    if (item.type !== "expense") return;
    const key = item.categoryName || "其他";
    expenseMap[key] = (expenseMap[key] || 0) + Number(item.amount || 0);
  });
  const topCategory = Object.keys(expenseMap).sort((a, b) => expenseMap[b] - expenseMap[a])[0] || "暂无";

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
    topCategory,
    familyMood: monthRecords.length ? "本月记录持续更新" : "本月还没有记录",
    monthRange,
    recentRecords: monthRecords.map((item) => attachRecordOwner(item, ownerMap, openid)),
  });
}

async function updateBudget(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  if (role !== "owner") throw new Error("ONLY_OWNER_CAN_UPDATE_BUDGET");
  const budgetEnabled = Boolean(data.budgetEnabled);
  const monthlyBudget = budgetEnabled ? Math.min(999999, Math.max(1, Number(data.monthlyBudget || 1))) : 0;
  await db.collection("ledgers").doc(ledger._id).update({ data: { budgetEnabled, monthlyBudget, updatedAt: now() } });
  return ok({ ledger: { ...ledger, budgetEnabled, monthlyBudget } });
}

async function updateMonthStartDay(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  if (role !== "owner") throw new Error("ONLY_OWNER_CAN_UPDATE_MONTH_START_DAY");
  const monthStartDay = Math.min(28, Math.max(1, Number(data.monthStartDay || 1)));
  await db.collection("ledgers").doc(ledger._id).update({ data: { monthStartDay, updatedAt: now() } });
  return ok({ ledger: { ...ledger, monthStartDay } });
}


async function createLedgerInviteToken(openid, data = {}) {
  if (!openid) return fail("请先登录", "LOGIN_REQUIRED");
  const ledger = await getLedgerById(data.ledgerId);
  if (!ledger) return fail("账本不存在", "LEDGER_NOT_FOUND");
  if (ledger.ownerOpenid !== openid) return fail("仅拥有者可邀请", "ONLY_OWNER_CAN_INVITE");

  const mode = ledger.type === "personal" ? "visitor" : (data.mode === "member" ? "member" : "visitor");
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

function getAlreadyJoinedMessage(role) {
  if (role === "owner") return "你已经是账本的拥有者";
  if (role === "readonly") return "你已经是访客了，无需重复加入";
  return "你已经是成员了，无需重复加入";
}

async function claimInviteForUser(invite, openid) {
  if (invite.claimedOpenid && invite.claimedOpenid !== openid) {
    return fail("当前无权限加入，请联系账本拥有者。", "INVITE_NOT_ALLOWED");
  }

  if (!invite.claimedOpenid) {
    await db.collection("ledgerInvites").doc(invite._id).update({
      data: { claimedOpenid: openid, updatedAt: now() },
    });
  }
  return null;
}

async function joinLedgerByInviteToken(openid, data = {}) {
  if (!openid) return fail("请先登录", "LOGIN_REQUIRED");
  const token = String(data.inviteToken || "").trim();
  if (!token) return fail("邀请信息不完整，请让账本拥有者重新分享。", "INVALID_INVITE_TOKEN");

  const inviteRes = await db.collection("ledgerInvites").where({ token }).limit(1).get();
  const invite = inviteRes.data[0];
  if (!invite) return fail("当前无权限加入，请联系账本拥有者。", "INVITE_NOT_ALLOWED");

  const ledger = await getLedgerById(invite.ledgerId);
  if (!ledger) return fail("账本不存在", "LEDGER_NOT_FOUND");

  const role = getLedgerRole(openid, ledger);
  if (role === "owner") {
    return ok({ ledgerId: ledger._id, ledger, role, already: true, message: getAlreadyJoinedMessage(role) });
  }

  const claimError = await claimInviteForUser(invite, openid);
  if (claimError) return claimError;

  if (role === "member" || role === "readonly") {
    return ok({ ledgerId: ledger._id, ledger, role, already: true, message: getAlreadyJoinedMessage(role) });
  }

  const mode = invite.mode === "member" && ledger.type === "shared" ? "member" : "visitor";
  if (mode === "member") {
    await db.collection("ledgers").doc(ledger._id).update({
      data: { members: _.push([{ openid, role: "member", joinedAt: new Date() }]), memberOpenids: _.push([openid]), updatedAt: now() },
    });
    const nextLedger = { ...ledger, memberOpenids: [...(ledger.memberOpenids || []), openid] };
    return ok({ ledgerId: ledger._id, ledger: nextLedger, role: "member", message: "加入成功" });
  }

  await db.collection("ledgers").doc(ledger._id).update({
    data: { viewers: _.push([{ openid, joinedAt: new Date() }]), viewerOpenids: _.push([openid]), updatedAt: now() },
  });
  const nextLedger = { ...ledger, viewerOpenids: [...(ledger.viewerOpenids || []), openid] };
  return ok({ ledgerId: ledger._id, ledger: nextLedger, role: "readonly", message: "加入成功" });
}
async function joinLedger(openid, data = {}) {
  const found = await db.collection("ledgers").where({ inviteCode: data.inviteCode }).limit(1).get();
  const ledger = found.data[0];
  if (!ledger) return fail("邀请码无效", "INVALID_INVITE_CODE");
  if ((ledger.memberOpenids || []).includes(openid)) return ok({ ledgerId: ledger._id, ledger });
  await db.collection("ledgers").doc(ledger._id).update({
    data: { members: _.push([{ openid, role: "member", joinedAt: new Date() }]), memberOpenids: _.push([openid]), updatedAt: now() },
  });
  return ok({ ledgerId: ledger._id, ledger });
}

async function joinReadonlyLedger(openid, data = {}) {
  const found = await db.collection("ledgers").where({ readonlyShareCode: data.readonlyShareCode }).limit(1).get();
  const ledger = found.data[0];
  if (!ledger) return fail("访客分享码无效", "INVALID_READONLY_CODE");
  if ((ledger.viewerOpenids || []).includes(openid)) return ok({ ledgerId: ledger._id, ledger });
  await db.collection("ledgers").doc(ledger._id).update({
    data: { viewers: _.push([{ openid, joinedAt: new Date() }]), viewerOpenids: _.push([openid]), updatedAt: now() },
  });
  return ok({ ledgerId: ledger._id, ledger });
}


async function deleteLedger(openid, data = {}) {
  if (!openid) return fail("微信登录失败，请稍后重试", "OPENID_MISSING");
  const ledgerId = data.ledgerId;
  const ledger = await getLedgerById(ledgerId);
  if (!ledger) return fail("账本不存在", "LEDGER_NOT_FOUND");
  if (ledger.ownerOpenid !== openid) return fail("仅拥有者可删除账本", "ONLY_OWNER_CAN_DELETE_LEDGER");

  await deleteByQuery("records", { ledgerId });
  await deleteByQuery("categories", { ledgerId });
  await db.collection("ledgers").doc(ledgerId).remove();

  const user = await getUser(openid);
  let currentLedger = null;
  let currentLedgerId = "";
  if (user && user.currentLedgerId === ledgerId) {
    const restLedgers = await listLedgersForUser(openid);
    currentLedger = restLedgers[0] || null;
    currentLedgerId = currentLedger ? currentLedger._id : "";
    await db.collection("users").doc(user._id).update({ data: { currentLedgerId, updatedAt: now() } });
  } else if (user) {
    currentLedgerId = user.currentLedgerId || "";
    currentLedger = currentLedgerId ? await getLedgerById(currentLedgerId) : null;
  }

  return ok({ currentLedgerId, currentLedger });
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
  if (!openid) return fail("\u5fae\u4fe1\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5", "OPENID_MISSING");
  if (data.confirm !== "RESET_TOMATO_LEDGER_DATABASE") {
    return fail("\u7f3a\u5c11\u6570\u636e\u5e93\u91cd\u7f6e\u786e\u8ba4", "RESET_CONFIRM_REQUIRED");
  }

  const collections = ["records", "categories", "ledgers", "ledgerInvites"];
  const entries = await Promise.all(collections.map(async (name) => [name, await clearCollection(name)]));
  const deleted = entries.reduce((result, [name, count]) => {
    result[name] = count;
    return result;
  }, {});
  return ok({ deleted });
}
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || event.type;
  const data = event.data || {};

  try {
    await ensureCollections();
    switch (action) {
      case "login": return await login(OPENID, data);
      case "resetDatabase": return await resetDatabase(OPENID, data);
      case "updateProfile": return await updateProfile(OPENID, data);
      case "createLedger": return await createLedger(OPENID, data);
      case "listLedgers": return await listLedgers(OPENID);
      case "setCurrentLedger": return await setCurrentLedger(OPENID, data);
      case "deleteLedger": return await deleteLedger(OPENID, data);
      case "createRecord": return await createRecord(OPENID, data);
      case "getRecord": return await getRecord(OPENID, data);
      case "listRecords": return await listRecords(OPENID, data);
      case "updateRecord": return await updateRecord(OPENID, data);
      case "deleteRecord": return await deleteRecord(OPENID, data);
      case "getDashboard": return await getDashboard(OPENID, data);
      case "updateBudget": return await updateBudget(OPENID, data);
      case "updateMonthStartDay": return await updateMonthStartDay(OPENID, data);
      case "createLedgerInviteToken": return await createLedgerInviteToken(OPENID, data);
      case "joinLedgerByInviteToken": return await joinLedgerByInviteToken(OPENID, data);
      case "joinLedger": return await joinLedger(OPENID, data);
      case "joinReadonlyLedger": return await joinReadonlyLedger(OPENID, data);
      default: return fail(`未知操作: ${action}`, "UNKNOWN_ACTION");
    }
  } catch (error) {
    console.error(action, error);
    return fail(error.message || "云函数执行失败");
  }
};
