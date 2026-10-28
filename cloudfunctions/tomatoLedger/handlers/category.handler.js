// 分类域：分类树查询、新建/编辑、可恢复删除（迁移到"其他"）。
const {
  db,
  ok,
  now,
  bumpLedgerSyncRevision,
  getLedgerForUser,
  getLedgerRole,
  assertReadable,
  assertLedgerId,
  getOperation,
  saveOperation,
  getCategoryById,
} = require("../shared/helpers");
const { ensureLedgerCategoryTree, addDefaultChild } = require("./category-tree");
const { assertCategoryInput } = require("../validators/schemas");

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

async function isProtectedOtherCategory(category) {
  if (category.isOther && category.level === "parent") return true;
  if (category.level !== "child" || !category.isDefaultChild || !category.parentId) return false;
  const parent = await getCategoryById(category.parentId);
  return Boolean(parent && parent.isOther);
}

async function saveCategory(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  const editing = Boolean(data.categoryId);
  if (editing && role !== "owner") throw new Error("ONLY_OWNER_CAN_EDIT_CATEGORY");
  if (!editing && !["owner", "member"].includes(role)) throw new Error("NO_CATEGORY_PERMISSION");
  const { name } = assertCategoryInput({ name: data.name });
  if (editing) {
    const category = await getCategoryById(data.categoryId);
    if (!category || category.ledgerId !== ledger._id) throw new Error("CATEGORY_NOT_FOUND");
    if (await isProtectedOtherCategory(category)) throw new Error("SYSTEM_CATEGORY_PROTECTED");
    await db
      .collection("categories")
      .doc(category._id)
      .update({ data: { name, icon: data.icon || category.icon, updatedAt: now() } });
    if (category.level === "parent")
      await db
        .collection("categories")
        .where({ ledgerId: ledger._id, parentId: category._id })
        .update({ data: { parentName: name, updatedAt: now() } });
    await bumpLedgerSyncRevision(ledger._id);
    return ok();
  }
  const level = data.level === "parent" ? "parent" : "child";
  if (level === "child" && !data.parentId) throw new Error("PARENT_REQUIRED");
  const parent = level === "child" ? await getCategoryById(data.parentId) : null;
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
      source: "custom",
      createdBy: openid,
      createdAt: now(),
      updatedAt: now(),
    },
  });
  if (level === "parent")
    await addDefaultChild(ledger._id, { _id: addResult._id, type, name, icon }, openid);
  await bumpLedgerSyncRevision(ledger._id);
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
  const category = await getCategoryById(data.categoryId);
  if (!category || category.ledgerId !== ledger._id) throw new Error("CATEGORY_NOT_FOUND");
  if (await isProtectedOtherCategory(category)) throw new Error("SYSTEM_CATEGORY_PROTECTED");
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
      const parent = await getCategoryById(category.parentId);
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
    await bumpLedgerSyncRevision(ledger._id);
  }
  return ok({ operationId: operation._id });
}

module.exports = {
  listCategories,
  saveCategory,
  removeCategory,
};
