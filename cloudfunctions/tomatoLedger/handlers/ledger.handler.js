// 账本域：账本 CRUD、成员管理、同步、邀请加入、可恢复删除。
const {
  db,
  _,
  ok,
  fail,
  now,
  bumpLedgerSyncRevision,
  generateUniqueInviteToken,
  generateUniqueLedgerCode,
  getUser,
  getLedgerById,
  listLedgersForUser,
  getLedgerForUser,
  getUsersByOpenids,
  resolveUsersAvatarUrls,
  getOperation,
  saveOperation,
  getLedgerInviteByToken,
  getLedgerRole,
  assertReadable,
  assertLedgerId,
  defaultAvatarUrl,
  SCHEMA_VERSION,
  defaultQuickAmounts,
  defaultPaymentAccounts,
} = require("../shared/helpers");
const { createDefaultCategories } = require("./category-tree");
const { assertOpenid, assertLedgerInput, assertInviteInput } = require("../validators/schemas");

// --- 账本 CRUD ---

async function createLedger(openid, data = {}) {
  assertOpenid(openid);

  const ledgerType = data.type === "shared" ? "shared" : "personal";
  const { name, remark, type } = assertLedgerInput({
    name: data.name,
    remark: data.remark,
    type: ledgerType,
  });
  void type; // assertLedgerInput 返回 type 但已在上方确定，保持结构不变

  const budgetEnabled = Boolean(data.budgetEnabled);
  const quickAmountsEnabled = Boolean(data.quickAmountsEnabled);
  const requestedBudget = Number(data.monthlyBudget);
  const monthlyBudget =
    budgetEnabled && Number.isFinite(requestedBudget)
      ? Math.min(999999, Math.max(1, Math.round(requestedBudget * 100) / 100))
      : 0;
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
    quickAmountsEnabled,
    quickAmounts: quickAmountsEnabled ? defaultQuickAmounts : [],
    accounts: defaultPaymentAccounts,
    accountsConfigured: true,
    syncRevision: 1,
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

async function updateLedger(openid, data = {}) {
  assertLedgerId(data.ledgerId);
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  if (role !== "owner") return fail("只有账本拥有者可以编辑账本", "ONLY_OWNER_CAN_UPDATE_LEDGER");

  const { name, remark } = assertLedgerInput({
    name: data.name,
    remark: data.remark,
  });

  if (name === String(ledger.name || "").trim() && remark === String(ledger.remark || "").trim())
    return ok({ changed: false, ledger });

  const syncRevision = Number(ledger.syncRevision || 0) + 1;
  await db
    .collection("ledgers")
    .doc(ledger._id)
    .update({
      data: {
        name,
        remark,
        syncRevision: _.inc(1),
        updatedAt: now(),
      },
    });
  return ok({ changed: true, ledger: { ...ledger, name, remark, syncRevision } });
}

async function listLedgers(openid) {
  const ledgers = await listLedgersForUser(openid);
  return ok({ ledgers });
}

// --- 同步 ---

function getLedgerRevisionMap(ledgers = []) {
  return ledgers.reduce((result, ledger) => {
    result[ledger._id] = Number(ledger.syncRevision || 1);
    return result;
  }, {});
}

async function syncLedgers(openid, data = {}) {
  const revisionRows =
    (
      await db
        .collection("ledgers")
        .where(
          _.or([{ ownerOpenid: openid }, { memberOpenids: openid }, { viewerOpenids: openid }])
        )
        .field({ _id: true, syncRevision: true })
        .get()
    ).data || [];
  await Promise.all(
    revisionRows
      .filter((ledger) => !Number(ledger.syncRevision))
      .map((ledger) =>
        db
          .collection("ledgers")
          .doc(ledger._id)
          .update({ data: { syncRevision: 1 } })
      )
  );
  const revisions = getLedgerRevisionMap(revisionRows);
  const clientRevisions =
    data.revisions && typeof data.revisions === "object" && !Array.isArray(data.revisions)
      ? data.revisions
      : {};
  const changedLedgerIds = Object.keys(revisions).filter(
    (ledgerId) =>
      !Object.prototype.hasOwnProperty.call(clientRevisions, ledgerId) ||
      Number(clientRevisions[ledgerId]) !== revisions[ledgerId]
  );
  const removedLedgerIds = Object.keys(clientRevisions).filter(
    (ledgerId) => !Object.prototype.hasOwnProperty.call(revisions, ledgerId)
  );
  const changed = Boolean(changedLedgerIds.length || removedLedgerIds.length);
  const ledgers = changed ? await listLedgersForUser(openid) : [];
  const user = await getUser(openid);
  const currentLedgerId =
    user && Object.prototype.hasOwnProperty.call(revisions, user.currentLedgerId)
      ? user.currentLedgerId
      : revisionRows[0]
        ? revisionRows[0]._id
        : "";
  const currentLedger = changed
    ? ledgers.find((ledger) => ledger._id === currentLedgerId) || null
    : null;
  if (user && user._id && user.currentLedgerId !== currentLedgerId) {
    await db
      .collection("users")
      .doc(user._id)
      .update({ data: { currentLedgerId, updatedAt: now() } });
  }
  return ok({
    changed,
    changedLedgerIds,
    removedLedgerIds,
    revisions,
    currentLedgerId,
    ...(changed ? { currentLedger, ledgers } : {}),
  });
}

// --- 成员管理 ---

function toUniqueOpenids(values = []) {
  return Array.from(new Set(values.map((value) => String(value || "")).filter(Boolean)));
}

async function getLedgerMembers(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertReadable(role);

  const memberOpenids = toUniqueOpenids([
    ledger.ownerOpenid,
    ...(ledger.memberOpenids || []),
    ...(ledger.members || []).map((item) => item.openid),
  ]);
  const viewerOpenids = toUniqueOpenids(ledger.viewerOpenids || []).filter(
    (item) => !memberOpenids.includes(item)
  );
  const users = await resolveUsersAvatarUrls(
    await getUsersByOpenids([...memberOpenids, ...viewerOpenids])
  );
  const memberRows = memberOpenids.map((memberOpenid) => {
    const user = users[memberOpenid] || {};
    const isOwner = memberOpenid === ledger.ownerOpenid;
    return {
      openid: memberOpenid,
      nickName: user.nickName || (isOwner ? "账本拥有者" : "账本成员"),
      avatarUrl: user.avatarUrl || defaultAvatarUrl,
      role: isOwner ? "owner" : "member",
    };
  });
  const visitorRows = viewerOpenids.map((viewerOpenid) => {
    const user = users[viewerOpenid] || {};
    return {
      openid: viewerOpenid,
      nickName: user.nickName || "账本访客",
      avatarUrl: user.avatarUrl || defaultAvatarUrl,
      role: "visitor",
    };
  });
  return ok({
    ledger: { id: ledger._id, name: ledger.name, type: ledger.type || "personal" },
    role,
    canManage: role === "owner",
    members: [...memberRows, ...visitorRows],
  });
}

async function removeLedgerMember(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  if (role !== "owner") throw new Error("ONLY_OWNER_CAN_MANAGE_MEMBERS");
  const targetOpenid = String(data.targetOpenid || "");
  if (!targetOpenid || targetOpenid === ledger.ownerOpenid)
    throw new Error("OWNER_CANNOT_BE_REMOVED");

  const memberOpenids = toUniqueOpenids(ledger.memberOpenids || []).filter(
    (item) => item !== targetOpenid
  );
  const viewerOpenids = toUniqueOpenids(ledger.viewerOpenids || []).filter(
    (item) => item !== targetOpenid
  );
  await db
    .collection("ledgers")
    .doc(ledger._id)
    .update({
      data: {
        members: (ledger.members || []).filter((item) => item.openid !== targetOpenid),
        memberOpenids,
        viewers: (ledger.viewers || []).filter((item) => item.openid !== targetOpenid),
        viewerOpenids,
        syncRevision: _.inc(1),
        updatedAt: now(),
      },
    });
  return ok();
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

// --- 邀请与加入 ---

async function createLedgerInviteToken(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  if (role !== "owner") throw new Error("ONLY_OWNER_CAN_INVITE");
  const mode = ledger.type === "shared" && data.mode === "member" ? "member" : "visitor";
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
  await bumpLedgerSyncRevision(ledger._id);
  return ok({ token, mode });
}

async function joinLedgerByInviteToken(openid, data = {}) {
  const token = String(data.inviteToken || "").trim();
  assertInviteInput({ token });
  const invite = await getLedgerInviteByToken(token);
  if (!invite) return fail("邀请链接无效", "INVALID_INVITE_TOKEN");

  const joined = await db.runTransaction(async (transaction) => {
    const currentInvite = (await transaction.collection("ledgerInvites").doc(invite._id).get())
      .data;
    if (!currentInvite) throw new Error("INVITE_NOT_FOUND");
    if (currentInvite.claimedOpenid && currentInvite.claimedOpenid !== openid)
      throw new Error("INVITE_ALREADY_CLAIMED");
    const ledger = (await transaction.collection("ledgers").doc(currentInvite.ledgerId).get()).data;
    if (!ledger) throw new Error("LEDGER_NOT_FOUND");

    const currentRole = getLedgerRole(openid, ledger);
    if (currentRole === "none") {
      const nextRole =
        currentInvite.mode === "member" && ledger.type === "shared" ? "member" : "readonly";
      if (nextRole === "member") {
        await transaction
          .collection("ledgers")
          .doc(ledger._id)
          .update({
            data: {
              members: [...(ledger.members || []), { openid, role: "member", joinedAt: now() }],
              memberOpenids: toUniqueOpenids([...(ledger.memberOpenids || []), openid]),
              syncRevision: _.inc(1),
              updatedAt: now(),
            },
          });
      } else {
        await transaction
          .collection("ledgers")
          .doc(ledger._id)
          .update({
            data: {
              viewers: [...(ledger.viewers || []), { openid, joinedAt: now() }],
              viewerOpenids: toUniqueOpenids([...(ledger.viewerOpenids || []), openid]),
              syncRevision: _.inc(1),
              updatedAt: now(),
            },
          });
      }
    }
    if (!currentInvite.claimedOpenid) {
      await transaction
        .collection("ledgerInvites")
        .doc(currentInvite._id)
        .update({
          data: { claimedOpenid: openid, updatedAt: now() },
        });
    }
    return ledger;
  });
  return ok({ ledgerId: joined._id, ledger: joined });
}

async function joinLedger(openid, data = {}) {
  assertInviteInput({ code: data.inviteCode });
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
        syncRevision: _.inc(1),
        updatedAt: now(),
      },
    });
  return ok({ ledgerId: ledger._id, ledger });
}

async function joinReadonlyLedger(openid, data = {}) {
  assertInviteInput({ code: data.readonlyShareCode });
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
        syncRevision: _.inc(1),
        updatedAt: now(),
      },
    });
  return ok({ ledgerId: ledger._id, ledger });
}

// --- 可恢复删除 ---

async function deleteByQuery(collectionName, query) {
  let deleted = 0;
  while (true) {
    const result = await db.collection(collectionName).where(query).limit(100).get();
    const rows = result.data || [];
    if (!rows.length) break;
    const removals = await Promise.all(
      rows.map(async (item) => {
        try {
          await db.collection(collectionName).doc(item._id).remove();
          return true;
        } catch (error) {
          const message = String((error && (error.errMsg || error.message)) || "");
          if (message.includes("does not exist")) return false;
          throw error;
        }
      })
    );
    deleted += removals.filter(Boolean).length;
  }
  return deleted;
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

module.exports = {
  createLedger,
  updateLedger,
  listLedgers,
  syncLedgers,
  getLedgerMembers,
  removeLedgerMember,
  setCurrentLedger,
  createLedgerInviteToken,
  joinLedgerByInviteToken,
  joinLedger,
  joinReadonlyLedger,
  deleteLedger,
};
