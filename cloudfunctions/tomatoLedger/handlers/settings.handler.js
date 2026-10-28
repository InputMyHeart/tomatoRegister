// Settings 域：快捷金额与支付账户配置。
const {
  db,
  ok,
  fail,
  now,
  bumpLedgerSyncRevision,
  getLedgerForUser,
  getLedgerRole,
  assertWritable,
} = require("../shared/helpers");

function normalizeQuickAmounts(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 5) return null;
  const normalized = values.map((value) => Math.round(Number(value) * 100) / 100);
  if (normalized.some((value) => !Number.isFinite(value) || value <= 0 || value > 999999))
    return null;
  return normalized;
}

async function updateQuickAmounts(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  if (role === "readonly") throw new Error("READONLY_LEDGER");
  const quickAmountsEnabled = Boolean(data.quickAmountsEnabled);
  const quickAmounts = quickAmountsEnabled ? normalizeQuickAmounts(data.quickAmounts) : [];
  if (quickAmountsEnabled && !quickAmounts)
    return fail("快捷金额需设置 1-5 个有效金额", "INVALID_QUICK_AMOUNTS");
  await db
    .collection("ledgers")
    .doc(ledger._id)
    .update({ data: { quickAmountsEnabled, quickAmounts, updatedAt: now() } });
  await bumpLedgerSyncRevision(ledger._id);
  return ok({ ledger: { ...ledger, quickAmountsEnabled, quickAmounts } });
}

function normalizePaymentAccounts(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 12) return null;
  const accounts = values.map((value) => String(value || "").trim());
  if (accounts.some((value) => !value || Array.from(value).length > 12)) return null;
  return Array.from(new Set(accounts));
}

async function updateAccounts(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  assertWritable(role);
  const accounts = normalizePaymentAccounts(data.accounts);
  if (!accounts) return fail("支付账户需设置 1-12 个有效名称", "INVALID_PAYMENT_ACCOUNTS");
  await db
    .collection("ledgers")
    .doc(ledger._id)
    .update({ data: { accounts, accountsConfigured: true, updatedAt: now() } });
  await bumpLedgerSyncRevision(ledger._id);
  return ok({ ledger: { ...ledger, accounts, accountsConfigured: true } });
}

module.exports = {
  updateQuickAmounts,
  updateAccounts,
};
