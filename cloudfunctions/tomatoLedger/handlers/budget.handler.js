// Budget 域：账本月度预算设置（Owner 专属）。
const {
  db,
  ok,
  now,
  bumpLedgerSyncRevision,
  getLedgerForUser,
  getLedgerRole,
} = require("../shared/helpers");
const { assertBudgetInput } = require("../validators/schemas");

async function updateBudget(openid, data = {}) {
  const ledger = await getLedgerForUser(openid, data.ledgerId);
  const role = getLedgerRole(openid, ledger);
  if (role !== "owner") throw new Error("ONLY_OWNER_CAN_UPDATE_BUDGET");

  const { enabled: budgetEnabled, monthlyBudget } = assertBudgetInput({
    budgetEnabled: data.budgetEnabled,
    monthlyBudget: data.monthlyBudget,
  });

  await db
    .collection("ledgers")
    .doc(ledger._id)
    .update({ data: { budgetEnabled, monthlyBudget, updatedAt: now() } });
  await bumpLedgerSyncRevision(ledger._id);
  return ok({ ledger: { ...ledger, budgetEnabled, monthlyBudget } });
}

module.exports = { updateBudget };
