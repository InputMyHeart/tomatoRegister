const test = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateAmountExpression,
  getAmountValidationMessage,
  limitAmountPrecision,
} = require("../miniprogram/utils/amount-expression");

test("amount expression calculates addition and subtraction", () => {
  assert.deepEqual(evaluateAmountExpression("12.5+8-3"), {
    value: 17.5,
    valid: true,
    text: "17.5",
  });
  assert.deepEqual(evaluateAmountExpression("0.1+0.2"), {
    value: 0.3,
    valid: true,
    text: "0.3",
  });
});

test("amount expression settles the completed part before an incomplete final part", () => {
  assert.deepEqual(evaluateAmountExpression("1+2-"), {
    value: 3,
    valid: true,
    text: "3",
  });
  assert.deepEqual(evaluateAmountExpression("1+2-0."), {
    value: 3,
    valid: true,
    text: "3",
  });
  assert.equal(evaluateAmountExpression("12.").valid, false);
});

test("amount expression rejects invalid formulas and labels non-positive totals", () => {
  assert.equal(evaluateAmountExpression("2..3").valid, false);
  assert.deepEqual(evaluateAmountExpression("2-2"), {
    value: 0,
    valid: false,
    text: "0",
  });
  assert.equal(
    getAmountValidationMessage("expense", evaluateAmountExpression("2-2")),
    "支出不可为0"
  );
  assert.equal(
    getAmountValidationMessage("income", evaluateAmountExpression("2-3")),
    "收入不可为0"
  );
  assert.equal(limitAmountPrecision("12.3456"), "12.34");
});
