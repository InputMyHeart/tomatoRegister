const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("dashboard requests bounded server aggregates instead of month pages", async () => {
  const pipelines = [];
  const aggregate = {
    ifNull: (...args) => ({ operator: "ifNull", args }),
    cond: (...args) => ({ operator: "cond", args }),
    eq: (...args) => ({ operator: "eq", args }),
    sum: (...args) => ({ operator: "sum", args }),
    max: (...args) => ({ operator: "max", args }),
  };
  const db = {
    collection(name) {
      assert.equal(name, "records");
      const pipeline = [];
      const query = {
        aggregate() {
          return this;
        },
        match(value) {
          pipeline.push({ stage: "match", value });
          return this;
        },
        project(value) {
          pipeline.push({ stage: "project", value });
          return this;
        },
        group(value) {
          pipeline.push({ stage: "group", value });
          return this;
        },
        sort(value) {
          pipeline.push({ stage: "sort", value });
          return this;
        },
        limit(value) {
          pipeline.push({ stage: "limit", value });
          return this;
        },
        async end() {
          pipelines.push(pipeline);
          return pipeline[0].value.type === "expense"
            ? { list: [{ _id: "餐饮", total: 200 }] }
            : {
                list: [
                  { _id: "income", total: 500, count: 1, largest: 500 },
                  { _id: "expense", total: 300, count: 101, largest: 90 },
                ],
              };
        },
      };
      return query;
    },
  };
  const source = fs.readFileSync(
    "cloudfunctions/tomatoLedger/handlers/dashboard.handler.js",
    "utf8"
  );
  const module = { exports: {} };
  vm.runInNewContext(`${source}\nmodule.exports.getMonthSummary = getMonthSummary;`, {
    module,
    exports: module.exports,
    require(name) {
      if (name === "../shared/helpers") return { db, $: aggregate };
      if (name === "../dashboard.helpers")
        return require("../cloudfunctions/tomatoLedger/dashboard.helpers");
      return {};
    },
  });

  const summary = await module.exports.getMonthSummary({ ledgerId: "ledger-1", date: "range" });
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), {
    income: 500,
    expense: 300,
    balance: 200,
    recordCount: 102,
    largestExpense: 90,
    topExpenseCategory: "餐饮",
  });
  assert.equal(pipelines.length, 2);
  assert.deepEqual(
    pipelines.map((pipeline) => pipeline.map((stage) => stage.stage)),
    [
      ["match", "group"],
      ["match", "project", "group", "sort", "limit"],
    ]
  );
  assert.equal(pipelines[1].at(-1).value, 1);
});
