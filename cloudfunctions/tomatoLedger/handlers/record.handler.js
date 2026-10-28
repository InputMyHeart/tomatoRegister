// 记录域：收支记录 CRUD、游标分页、模板下载与批量导入。
const cloud = require("wx-server-sdk");
const {
  db,
  _,
  $,
  ok,
  fail,
  now,
  bumpLedgerSyncRevision,
  getLedgerForUser,
  getUsersByOpenids,
  resolveUsersAvatarUrls,
  getLedgerRole,
  getRoleText,
  assertReadable,
  assertWritable,
  defaultAvatarUrl,
  SCHEMA_VERSION,
  defaultPaymentAccounts,
  getRecordById,
} = require("../shared/helpers");
const { roundMoney: roundAnalysisMoney } = require("../analysis.helpers");
const { assertRecordPayload } = require("../validators/schemas");

// --- 校验与展示辅助 ---

function attachRecordOwner(record = {}, ownerMap = {}, currentOpenid = "") {
  const owner = ownerMap[record.ownerOpenid] || {};
  return {
    ...record,
    id: record._id || record.id,
    memberName: owner.nickName || (record.ownerOpenid === currentOpenid ? "我" : "成员"),
    memberAvatar: owner.avatarUrl || defaultAvatarUrl,
  };
}

// --- 记录 CRUD ---

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
    syncVersion: 1,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now(),
    updatedAt: now(),
  };
  const res = await db.collection("records").add({ data: record });
  await bumpLedgerSyncRevision(ledger._id);
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
  let query = baseQuery;
  if (cursor) {
    const cursorRecord = await getRecordById(cursor.id);
    if (
      !cursorRecord ||
      cursorRecord.ledgerId !== ledger._id ||
      cursorRecord.date !== cursor.date ||
      !cursorRecord.createdAt
    )
      throw new Error("INVALID_RECORD_CURSOR");
    query = _.and([
      baseQuery,
      _.or([
        { date: _.lt(cursor.date) },
        { date: cursor.date, createdAt: _.lt(cursorRecord.createdAt) },
        {
          date: cursor.date,
          createdAt: cursorRecord.createdAt,
          _id: _.lt(cursor.id),
        },
      ]),
    ]);
  }
  const historyQuery = { ledgerId: ledger._id };
  const rangeQuery = { ledgerId: ledger._id };
  if (data.start && data.end) rangeQuery.date = _.gte(data.start).and(_.lt(data.end));
  const [historyCountResult, rangeCountResult, rangeSummaryResult, latestRecordResult] =
    await Promise.all([
      db.collection("records").where(historyQuery).count(),
      db.collection("records").where(rangeQuery).count(),
      db
        .collection("records")
        .aggregate()
        .match(rangeQuery)
        .group({ _id: "$type", total: $.sum("$amount") })
        .end(),
      db
        .collection("records")
        .where(historyQuery)
        .orderBy("date", "desc")
        .orderBy("createdAt", "desc")
        .orderBy("_id", "desc")
        .limit(1)
        .get(),
    ]);
  const rangeSummary = (rangeSummaryResult.list || []).reduce(
    (summary, item) => {
      if (item._id === "income") summary.income = roundAnalysisMoney(item.total);
      if (item._id === "expense") summary.expense = roundAnalysisMoney(item.total);
      return summary;
    },
    { income: 0, expense: 0 }
  );
  const result = await db
    .collection("records")
    .where(query)
    .orderBy("date", "desc")
    .orderBy("createdAt", "desc")
    .orderBy("_id", "desc")
    .limit(pageSize + 1)
    .get();
  const rows = result.data || [];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const ownerMap = await resolveUsersAvatarUrls(
    await getUsersByOpenids(page.map((item) => item.ownerOpenid))
  );
  const last = page[page.length - 1];
  return ok({
    records: page.map((item) => attachRecordOwner(item, ownerMap, openid)),
    nextCursor: hasMore && last ? { date: last.date, id: last._id } : null,
    hasMore,
    historyRecordCount: historyCountResult.total || 0,
    rangeRecordCount: rangeCountResult.total || 0,
    rangeSummary,
    latestRecordDate: ((latestRecordResult.data || [])[0] || {}).date || "",
    ledger: {
      _id: ledger._id,
      name: ledger.name,
      type: ledger.type || "personal",
      budgetEnabled: Boolean(ledger.budgetEnabled),
      monthlyBudget: Number(ledger.monthlyBudget || 0),
    },
    role,
    roleText: getRoleText(role),
    readonly: role === "readonly",
  });
}

async function getRecord(openid, data = {}) {
  const recordId = data.recordId || data.id;
  if (!recordId) return fail("记录不存在", "RECORD_NOT_FOUND");
  const record = await getRecordById(recordId);
  if (!record) return fail("记录不存在", "RECORD_NOT_FOUND");
  const ledger = await getLedgerForUser(openid, record.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertReadable(role);
  const ownerMap = await resolveUsersAvatarUrls(await getUsersByOpenids([record.ownerOpenid]));
  return ok({
    record: attachRecordOwner(record, ownerMap, openid),
    ledger: {
      _id: ledger._id,
      name: ledger.name,
      type: ledger.type || "personal",
      accounts: ledger.accounts || defaultPaymentAccounts,
      accountsConfigured: Boolean(ledger.accountsConfigured),
    },
    role,
    roleText: getRoleText(role),
    readonly: role === "readonly",
  });
}

async function updateRecord(openid, data = {}) {
  assertRecordPayload(data);
  const record = await getRecordById(data.recordId);
  if (!record) {
    const error = new Error("记录已被删除");
    error.code = "RECORD_NOT_FOUND";
    throw error;
  }
  const ledger = await getLedgerForUser(openid, record.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertWritable(role);
  if (role !== "owner" && record.ownerOpenid !== openid)
    throw new Error("ONLY_OWNER_CAN_EDIT_OTHERS");

  // 乐观锁：客户端必须传入 syncVersion，服务端校验是否匹配
  const clientVersion = Number(data.syncVersion || 0);
  if (clientVersion && Number(record.syncVersion || 0) !== clientVersion) {
    const error = new Error("记录已被其他成员修改，请刷新后重试");
    error.code = "RECORD_CONFLICT";
    throw error;
  }

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
        syncVersion: _.inc(1),
        updatedAt: now(),
      },
    });
  await bumpLedgerSyncRevision(ledger._id);
  return ok();
}

async function deleteRecord(openid, data = {}) {
  const record = await getRecordById(data.recordId);
  if (!record) {
    const error = new Error("记录已被删除");
    error.code = "RECORD_NOT_FOUND";
    throw error;
  }
  const ledger = await getLedgerForUser(openid, record.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertWritable(role);
  if (role !== "owner" && record.ownerOpenid !== openid)
    throw new Error("ONLY_OWNER_CAN_DELETE_OTHERS");

  const clientVersion = Number(data.syncVersion || 0);
  if (clientVersion && Number(record.syncVersion || 0) !== clientVersion) {
    const error = new Error("记录已被其他成员修改，请刷新后重试");
    error.code = "RECORD_CONFLICT";
    throw error;
  }

  await db.collection("records").doc(data.recordId).remove();
  await bumpLedgerSyncRevision(ledger._id);
  return ok();
}

// --- 导入 ---

function importCell(row, names) {
  for (const name of names)
    if (row[name] !== undefined && row[name] !== null && row[name] !== "") return row[name];
  return "";
}

function importDate(value, xlsx) {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  if (typeof value === "number" && xlsx && xlsx.SSF) {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed)
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const matched = String(value || "").match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  return matched
    ? `${matched[1]}-${String(matched[2]).padStart(2, "0")}-${String(matched[3]).padStart(2, "0")}`
    : "";
}

function parseHtmlImportRows(buffer) {
  const html = buffer.toString("utf8");
  const clean = (value) =>
    String(value || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const table of tables) {
    const rows = (table.match(/<tr[\s\S]*?<\/tr>/gi) || []).map((row) =>
      (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(clean)
    );
    const headerIndex = rows.findIndex(
      (row) => row.includes("日期") && row.some((cell) => cell.includes("收支类型"))
    );
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex];
    return rows
      .slice(headerIndex + 1)
      .filter((row) => row.length)
      .map((row) =>
        headers.reduce((item, header, index) => ({ ...item, [header]: row[index] || "" }), {})
      );
  }
  return [];
}

async function getImportTemplate(openid) {
  if (!openid) throw new Error("LOGIN_REQUIRED");
  const xlsx = require("xlsx");
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet([
    ["日期*", "收支类型*", "金额*", "一级分类", "二级分类", "账户", "备注", "标签"],
    ["2026-06-01", "支出", 38.5, "餐饮", "午餐", "微信", "工作日午餐", "日常,餐饮"],
    ["2026-06-02", "收入", 5000, "工资", "工资", "银行卡", "六月工资", "固定收入"],
  ]);
  sheet["!cols"] = [14, 14, 12, 16, 16, 14, 28, 20].map((wch) => ({ wch }));
  xlsx.utils.book_append_sheet(workbook, sheet, "导入模板");
  const fileContent = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });
  const uploaded = await cloud.uploadFile({
    cloudPath: "templates/tomato-ledger-import-template.xlsx",
    fileContent,
  });
  const temporary = await cloud.getTempFileURL({ fileList: [uploaded.fileID] });
  const file = (temporary.fileList || [])[0] || {};
  if (!file.tempFileURL) throw new Error("IMPORT_TEMPLATE_UNAVAILABLE");
  return ok({ fileId: uploaded.fileID, url: file.tempFileURL });
}

async function importRecords(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertWritable(role);
  const fileId = String(data.fileId || "");
  if (!fileId.startsWith("cloud://")) throw new Error("IMPORT_FILE_REQUIRED");
  const download = await cloud.downloadFile({ fileID: fileId });
  let rows = parseHtmlImportRows(download.fileContent);
  let xlsx;
  if (!rows.length) {
    xlsx = require("xlsx");
    const workbook = xlsx.read(download.fileContent, { type: "buffer", cellDates: true });
    for (const name of workbook.SheetNames) {
      const parsed = xlsx.utils.sheet_to_json(workbook.Sheets[name], { defval: "" });
      if (parsed.some((row) => importCell(row, ["日期", "日期*"]))) {
        rows = parsed;
        break;
      }
    }
  }
  if (!rows.length) throw new Error("IMPORT_FORMAT_UNSUPPORTED");
  if (rows.length > 200) throw new Error("IMPORT_RECORD_LIMIT_EXCEEDED");
  const records = [];
  const errors = [];
  rows.forEach((row, index) => {
    const date = importDate(importCell(row, ["日期", "日期*"]), xlsx);
    const rawType = String(importCell(row, ["收支类型", "收支类型*"])).trim();
    const type = ["收入", "income"].includes(rawType.toLowerCase())
      ? "income"
      : ["支出", "expense"].includes(rawType.toLowerCase())
        ? "expense"
        : "";
    const amount = Number(importCell(row, ["金额", "金额*", "收入金额", "支出金额"]));
    if (!date || !type || !Number.isFinite(amount) || amount <= 0) {
      errors.push(`第 ${index + 2} 行：日期、收支类型或金额无效`);
      return;
    }
    const parentCategory = String(importCell(row, ["类别", "一级分类"]) || "其他").trim();
    const categoryName = String(
      importCell(row, ["子类", "二级分类"]) || parentCategory || "其他"
    ).trim();
    const tags = String(importCell(row, ["标签"]) || "")
      .split(/[\s,，]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
    records.push({
      ledgerId: ledger._id,
      ownerOpenid: openid,
      type,
      amount,
      categoryId: "",
      categoryName,
      categoryLabel: categoryName,
      categoryIcon: "price-tag-3-line",
      parentCategory,
      parentIcon: "more-2-line",
      note: String(importCell(row, ["备注"]) || "").slice(0, 100),
      tags,
      account: String(importCell(row, ["账户"]) || data.defaultAccount || "微信"),
      date,
      time: "",
      schemaVersion: SCHEMA_VERSION,
      createdAt: now(),
      updatedAt: now(),
    });
  });
  for (let index = 0; index < records.length; index += 20)
    await Promise.all(
      records
        .slice(index, index + 20)
        .map((record) => db.collection("records").add({ data: record }))
    );
  if (records.length) await bumpLedgerSyncRevision(ledger._id);
  const dates = records.map((record) => record.date).sort();
  return ok({
    imported: records.length,
    skipped: errors.length,
    errors: errors.slice(0, 20),
    startDate: dates[0] || "",
    endDate: dates[dates.length - 1] || "",
  });
}

module.exports = {
  attachRecordOwner,
  createRecord,
  listRecords,
  getRecord,
  updateRecord,
  deleteRecord,
  getImportTemplate,
  importRecords,
};
