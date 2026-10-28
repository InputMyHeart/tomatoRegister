// 领域校验函数：从各 handler 中抽离的字段级校验，保证同一字段在不同入口的规则完全一致。
const { ERR } = require("../shared/constants");

function assertObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error(ERR.INVALID_PAYLOAD);
    error.code = ERR.INVALID_PAYLOAD;
    throw error;
  }
}

function assertOpenid(openid) {
  if (!openid) {
    const error = new Error("微信登录失败，请稍后重试");
    error.code = ERR.OPENID_MISSING;
    throw error;
  }
}

// --- ledger ---

function assertLedgerInput({ name, remark, type }) {
  if (
    !name ||
    Array.from(String(name).trim()).length < 1 ||
    Array.from(String(name).trim()).length > 8
  ) {
    const error = new Error("账本名称需为1-8个字符");
    error.code = ERR.INVALID_LEDGER_NAME;
    throw error;
  }
  if (remark !== undefined && Array.from(String(remark).trim()).length > 80) {
    const error = new Error("账本备注最多 80 个字");
    error.code = ERR.INVALID_LEDGER_REMARK;
    throw error;
  }
  return { name: String(name).trim(), remark: String(remark || "").trim(), type };
}

// --- record ---

function assertRecordPayload(data = {}) {
  const amount = Number(data.amount);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 99999999 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001
  ) {
    const error = new Error("INVALID_RECORD_AMOUNT");
    error.code = ERR.INVALID_RECORD_AMOUNT;
    throw error;
  }
  if (!["income", "expense"].includes(data.type)) {
    const error = new Error("INVALID_RECORD_TYPE");
    error.code = ERR.INVALID_RECORD_TYPE;
    throw error;
  }
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    const error = new Error("INVALID_RECORD_DATE");
    error.code = ERR.INVALID_RECORD_DATE;
    throw error;
  }
  if (Array.isArray(data.tags) && data.tags.length > 8) {
    const error = new Error("INVALID_RECORD_TAGS");
    error.code = ERR.INVALID_RECORD_TAGS;
    throw error;
  }
}

function assertRecordCursor(cursor, createdAt) {
  if (
    !cursor ||
    !cursor.date ||
    !cursor.id ||
    !/^\d{4}-\d{2}-\d{2}$/.test(cursor.date) ||
    !createdAt
  ) {
    const error = new Error("INVALID_RECORD_CURSOR");
    error.code = ERR.INVALID_RECORD_CURSOR;
    throw error;
  }
}

// --- category ---

function assertCategoryInput({ name, type, level }) {
  const trimmed = String(name || "").trim();
  if (!trimmed || Array.from(trimmed).length > 6) {
    const error = new Error("INVALID_CATEGORY_NAME");
    error.code = ERR.INVALID_CATEGORY_NAME;
    throw error;
  }
  if (type && !["income", "expense"].includes(type)) {
    const error = new Error("INVALID_CATEGORY_TYPE");
    error.code = "INVALID_CATEGORY_TYPE";
    throw error;
  }
  return { name: trimmed, type, level };
}

// --- budget ---

function assertBudgetInput({ budgetEnabled, monthlyBudget }) {
  const enabled = Boolean(budgetEnabled);
  const requested = Number(monthlyBudget);
  if (enabled && (!Number.isFinite(requested) || requested < 1 || requested > 999999)) {
    const error = new Error("预算金额需为 1-999999");
    error.code = ERR.INVALID_MONTHLY_BUDGET;
    throw error;
  }
  return {
    enabled,
    monthlyBudget:
      enabled && Number.isFinite(requested)
        ? Math.min(999999, Math.max(1, Math.round(requested * 100) / 100))
        : 0,
  };
}

// --- profile ---

function assertProfileInput({ nickName, avatarUrl, systemNickName }) {
  const trimmedNick = String(nickName || "").trim();
  if (!trimmedNick) {
    const error = new Error("请输入昵称");
    error.code = ERR.INVALID_NICKNAME;
    throw error;
  }
  if (trimmedNick.length > 20) {
    const error = new Error("昵称最多 20 个字");
    error.code = ERR.INVALID_NICKNAME;
    throw error;
  }
  if (/^番茄用户#\d{4}$/.test(trimmedNick) && trimmedNick !== systemNickName) {
    const error = new Error("该昵称为系统编号格式，请换一个昵称");
    error.code = ERR.RESERVED_NICKNAME;
    throw error;
  }
  const avatar = String(avatarUrl || "");
  if (avatar && !avatar.startsWith("cloud://") && !avatar.startsWith("/images/")) {
    const error = new Error("头像尚未上传至云端，请重新选择后保存");
    error.code = ERR.AVATAR_NOT_PERSISTED;
    throw error;
  }
  return { nickName: trimmedNick, avatarUrl: avatar };
}

// --- invite ---

function assertInviteInput({ code, token }) {
  if (code !== undefined && !code) {
    const error = new Error("邀请码无效");
    error.code = ERR.INVALID_INVITE_CODE;
    throw error;
  }
  if (token !== undefined && !String(token).trim()) {
    const error = new Error("邀请链接无效");
    error.code = ERR.INVALID_INVITE_TOKEN;
    throw error;
  }
}

module.exports = {
  assertObject,
  assertOpenid,
  assertLedgerInput,
  assertRecordPayload,
  assertRecordCursor,
  assertCategoryInput,
  assertBudgetInput,
  assertProfileInput,
  assertInviteInput,
};
