function toNumber(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function formatMoney(value, options = {}) {
  const { fixed = true, sign = false } = options;
  const amount = roundMoney(value);
  const prefix = sign && amount > 0 ? "+" : "";
  return `${prefix}${fixed ? amount.toFixed(2) : amount}`;
}

function formatDisplayMoney(value) {
  const amount = roundMoney(value);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

module.exports = { toNumber, roundMoney, formatMoney, formatDisplayMoney };
