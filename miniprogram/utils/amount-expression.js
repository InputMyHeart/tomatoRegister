function limitAmountPrecision(rawValue) {
  return String(rawValue || "").replace(/(\.\d{2})\d+/g, "$1");
}

function isCompleteAmountPart(part) {
  return /^\d+(\.\d{1,2})?$/.test(part);
}

function getCompleteExpression(expression) {
  const parts = expression.split(/([+-])/);
  if (!isCompleteAmountPart(parts[0])) return "";

  let completeExpression = parts[0];
  for (let index = 1; index < parts.length; index += 2) {
    const operator = parts[index];
    const part = parts[index + 1];
    if (!operator || part === undefined) return "";
    if (isCompleteAmountPart(part)) {
      completeExpression += `${operator}${part}`;
      continue;
    }
    const isLastPart = index + 1 === parts.length - 1;
    if (isLastPart && /^\d*\.?$/.test(part)) return completeExpression;
    return "";
  }
  return completeExpression;
}

function amountPartToCents(part) {
  const negative = part.startsWith("-");
  const source = part.replace(/^[+-]/, "");
  const [whole, fraction = ""] = source.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return negative ? -cents : cents;
}

function centsToText(cents) {
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${cents < 0 ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function evaluateAmountExpression(rawValue) {
  const expression = limitAmountPrecision(rawValue).replace(/\s/g, "");
  if (!expression) return { value: 0, valid: false, text: "" };

  const completeExpression = getCompleteExpression(expression);
  if (!completeExpression) return { value: 0, valid: false, text: "" };

  const cents = (completeExpression.match(/[+-]?\d+(\.\d{1,2})?/g) || []).reduce(
    (sum, part) => sum + amountPartToCents(part),
    0
  );
  return { value: cents / 100, valid: cents > 0, text: centsToText(cents) };
}

function getAmountValidationMessage(type, result) {
  if (result && result.text && result.value <= 0) {
    return type === "income" ? "收入不可为0" : "支出不可为0";
  }
  return "请输入有效金额";
}

module.exports = {
  evaluateAmountExpression,
  getAmountValidationMessage,
  limitAmountPrecision,
};
