// 分类引导：建账时初始化默认分类树，以及懒修复缺失的默认子分类。
// 被 ledger.handler（createLedger）和未来的 category handler 共用，独立成模块避免循环依赖。
const { db, now, OTHER_CATEGORY_SORT } = require("../shared/helpers");

const categoryTreeDefaults = {
  expense: [
    ["餐饮", "restaurant-2-line", ["早餐", "午餐", "晚餐", "买菜", "咖啡奶茶"]],
    ["购物", "shopping-bag-3-line", ["日用品", "服饰鞋包", "数码电器", "美妆个护"]],
    ["交通", "taxi-line", ["公交地铁", "打车", "加油充电", "停车"]],
    ["居家", "home-4-line", ["房租房贷", "水电燃气", "物业", "维修"]],
    ["生活", "heart-pulse-line", ["医疗", "学习", "娱乐", "旅行"]],
    ["其他", "more-2-line", ["其他支出"]],
  ],
  income: [
    ["工作收入", "wallet-3-line", ["工资", "奖金", "加班", "报销"]],
    ["副业收入", "briefcase-4-line", ["副业", "项目", "稿费", "咨询"]],
    ["资产收入", "funds-line", ["理财", "利息", "分红", "房租"]],
    ["其他", "more-2-line", ["红包", "退款", "礼金", "其他收入"]],
  ],
};

async function addDefaultChild(ledgerId, parent, openid) {
  const existing = await db
    .collection("categories")
    .where({ ledgerId, level: "child", parentId: parent._id, isDefaultChild: true })
    .limit(1)
    .get();
  if (existing.data.length) {
    const child = existing.data[0];
    if (child.source !== "system") {
      await db
        .collection("categories")
        .doc(child._id)
        .update({ data: { source: "system", updatedAt: now() } });
      child.source = "system";
    }
    return child;
  }
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
      source: "system",
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
    await Promise.all(
      parentResult.data.map(async (parent) => {
        if (
          parent.isOther &&
          (parent.source !== "system" || Number(parent.sort) !== OTHER_CATEGORY_SORT)
        ) {
          await db
            .collection("categories")
            .doc(parent._id)
            .update({
              data: { source: "system", sort: OTHER_CATEGORY_SORT, updatedAt: now() },
            });
        }
        return addDefaultChild(ledgerId, parent, openid);
      })
    );
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
          sort: name === "其他" ? OTHER_CATEGORY_SORT : index,
          isOther: name === "其他",
          source: "system",
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
              source: "system",
              createdBy: openid,
              createdAt: now(),
              updatedAt: now(),
            },
          })
        )
      );
    }
}

async function createDefaultCategories(ledgerId, openid) {
  return ensureLedgerCategoryTree(ledgerId, openid);
}

module.exports = {
  categoryTreeDefaults,
  addDefaultChild,
  ensureLedgerCategoryTree,
  createDefaultCategories,
};
