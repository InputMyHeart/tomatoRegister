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

function makeCode(prefix) {
  return `${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function ensureCollections() {
  const names = ["users", "ledgers", "categories", "records"];
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
      const ledgerRes = await createLedger(openid, {
        name: "我家账本",
        type: "shared",
        monthlyBudget: 9000,
      });
      currentLedgerId = ledgerRes.data.ledgerId;
      currentLedger = { ...ledgerRes.data.ledger, _id: currentLedgerId };
      await db.collection("users").doc(user._id).update({ data: { currentLedgerId, updatedAt: now() } });
      user = { ...user, currentLedgerId };
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
  const ledgerRes = await createLedger(openid, {
    name: "我家账本",
    type: "shared",
    monthlyBudget: 9000,
  });
  await db.collection("users").doc(userRes._id).update({
    data: { currentLedgerId: ledgerRes.data.ledgerId, updatedAt: now() },
  });

  return ok({
    openid,
    isNewUser: true,
    user: { ...user, _id: userRes._id, currentLedgerId: ledgerRes.data.ledgerId },
    currentLedger: { ...ledgerRes.data.ledger, _id: ledgerRes.data.ledgerId },
    stats: { recordCount: 0, ledgerCount: 1 },
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
  const ledger = {
    name: data.name || "我家账本",
    type: data.type || "personal",
    ownerOpenid: openid,
    members: [{ openid, role: "owner", joinedAt: new Date() }],
    memberOpenids: [openid],
    viewers: [],
    viewerOpenids: [],
    inviteCode: makeCode("T"),
    readonlyShareCode: makeCode("R"),
    monthlyBudget: Number(data.monthlyBudget || 0),
    accounts: data.accounts || ["微信", "支付宝", "银行卡", "现金"],
    createdAt: now(),
    updatedAt: now(),
  };
  const res = await db.collection("ledgers").add({ data: ledger });
  await createDefaultCategories(res._id, openid);
  return ok({ ledgerId: res._id, ledger });
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

function assertReadable(role) {
  if (!["owner", "member", "readonly"].includes(role)) throw new Error("NO_LEDGER_ACCESS");
}

function assertWritable(role) {
  if (!["owner", "member"].includes(role)) throw new Error("READONLY_LEDGER");
}

async function listLedgers(openid) {
  const ledgers = await db.collection("ledgers").where(_.or([
    { ownerOpenid: openid },
    { memberOpenids: openid },
    { viewerOpenids: openid },
  ])).get();
  return ok({ ledgers: ledgers.data });
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
    note: data.note || "",
    account: data.account || "微信",
    date: data.date || new Date().toISOString().slice(0, 10),
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
  const result = await db.collection("records").where(query).orderBy("date", "desc").limit(100).get();
  return ok({ records: result.data, role });
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
      note: data.note || "",
      account: data.account || record.account,
      date: data.date || record.date,
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

async function getDashboard(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertReadable(role);

  const records = await db.collection("records").where({ ledgerId: ledger._id }).orderBy("date", "desc").limit(50).get();
  const monthRecords = records.data;
  const monthIncome = monthRecords.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const monthExpense = monthRecords.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const budget = Number(ledger.monthlyBudget || 0);
  const budgetRate = budget ? Math.min(100, Math.round((monthExpense / budget) * 100)) : 0;

  return ok({
    ledgerName: ledger.name,
    roleText: role === "owner" ? "创建者" : role === "member" ? "成员" : "只读",
    readonly: role === "readonly",
    monthIncome,
    monthExpense,
    balance: Number((monthIncome - monthExpense).toFixed(2)),
    budget,
    budgetLeft: Number((budget - monthExpense).toFixed(2)),
    budgetRate,
    recentRecords: monthRecords.slice(0, 5).map((item) => ({ ...item, id: item._id, memberName: item.ownerOpenid === openid ? "我" : "家人" })),
  });
}

async function updateBudget(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  if (role !== "owner") throw new Error("ONLY_OWNER_CAN_UPDATE_BUDGET");
  await db.collection("ledgers").doc(ledger._id).update({ data: { monthlyBudget: Number(data.monthlyBudget || 0), updatedAt: now() } });
  return ok();
}

async function joinLedger(openid, data = {}) {
  const found = await db.collection("ledgers").where({ inviteCode: data.inviteCode }).limit(1).get();
  const ledger = found.data[0];
  if (!ledger) return fail("邀请码无效", "INVALID_INVITE_CODE");
  if ((ledger.memberOpenids || []).includes(openid)) return ok({ ledgerId: ledger._id });
  await db.collection("ledgers").doc(ledger._id).update({
    data: { members: _.push([{ openid, role: "member", joinedAt: new Date() }]), memberOpenids: _.push([openid]), updatedAt: now() },
  });
  return ok({ ledgerId: ledger._id });
}

async function joinReadonlyLedger(openid, data = {}) {
  const found = await db.collection("ledgers").where({ readonlyShareCode: data.readonlyShareCode }).limit(1).get();
  const ledger = found.data[0];
  if (!ledger) return fail("只读分享码无效", "INVALID_READONLY_CODE");
  if ((ledger.viewerOpenids || []).includes(openid)) return ok({ ledgerId: ledger._id });
  await db.collection("ledgers").doc(ledger._id).update({
    data: { viewers: _.push([{ openid, joinedAt: new Date() }]), viewerOpenids: _.push([openid]), updatedAt: now() },
  });
  return ok({ ledgerId: ledger._id });
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || event.type;
  const data = event.data || {};

  try {
    await ensureCollections();
    switch (action) {
      case "login": return await login(OPENID, data);
      case "updateProfile": return await updateProfile(OPENID, data);
      case "createLedger": return await createLedger(OPENID, data);
      case "listLedgers": return await listLedgers(OPENID);
      case "createRecord": return await createRecord(OPENID, data);
      case "listRecords": return await listRecords(OPENID, data);
      case "updateRecord": return await updateRecord(OPENID, data);
      case "deleteRecord": return await deleteRecord(OPENID, data);
      case "getDashboard": return await getDashboard(OPENID, data);
      case "updateBudget": return await updateBudget(OPENID, data);
      case "joinLedger": return await joinLedger(OPENID, data);
      case "joinReadonlyLedger": return await joinReadonlyLedger(OPENID, data);
      default: return fail(`未知操作: ${action}`, "UNKNOWN_ACTION");
    }
  } catch (error) {
    console.error(action, error);
    return fail(error.message || "云函数执行失败");
  }
};