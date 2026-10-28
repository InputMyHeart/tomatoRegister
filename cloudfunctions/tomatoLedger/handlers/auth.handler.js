const {
  db,
  _,
  ok,
  now,
  getUser,
  getLedgerById,
  listLedgersForUser,
  defaultAvatarUrl,
} = require("../shared/helpers");
const { assertOpenid, assertProfileInput } = require("../validators/schemas");

// --- 用户辅助函数 ---

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

// --- 用户 Profile ---

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

  if (changed && nextUser._id) {
    await db
      .collection("users")
      .doc(nextUser._id)
      .update({
        data: {
          userNo: nextUser.userNo,
          nickName: nextUser.nickName,
          avatarUrl: nextUser.avatarUrl,
          updatedAt: now(),
        },
      });
  }

  return nextUser;
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

// --- 业务入口 ---

async function login(openid) {
  assertOpenid(openid);

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
  assertOpenid(openid);
  const user = await getUser(openid);
  if (!user) {
    const error = new Error("请先登录");
    error.code = "LOGIN_REQUIRED";
    throw error;
  }

  const systemNickName = makeUserName(user.userNo);
  const { nickName, avatarUrl } = assertProfileInput({
    nickName: data.nickName,
    avatarUrl: data.avatarUrl,
    systemNickName,
  });

  const nextUser = {
    ...user,
    nickName,
    avatarUrl: avatarUrl || user.avatarUrl || defaultAvatarUrl,
    updatedAt: now(),
  };

  await db
    .collection("users")
    .doc(user._id)
    .update({
      data: {
        nickName: nextUser.nickName,
        avatarUrl: nextUser.avatarUrl,
        updatedAt: now(),
      },
    });

  return ok({ user: nextUser });
}

module.exports = {
  login,
  updateProfile,
  normalizeUserProfile,
  getUserStats,
  generateUniqueUserNo,
  isPlaceholderName,
  makeUserName,
};
