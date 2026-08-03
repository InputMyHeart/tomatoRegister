const DEFAULT_PAYMENT_ACCOUNTS = ["微信", "支付宝", "银行卡", "信用卡", "现金"];

function getPaymentAccounts(ledger = {}) {
  const accounts = Array.isArray(ledger.accounts)
    ? ledger.accounts.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  if (ledger.accountsConfigured) return accounts.length ? accounts : DEFAULT_PAYMENT_ACCOUNTS;
  return Array.from(new Set([...DEFAULT_PAYMENT_ACCOUNTS, ...accounts]));
}

module.exports = { DEFAULT_PAYMENT_ACCOUNTS, getPaymentAccounts };
