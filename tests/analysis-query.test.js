const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadReader(records) {
  const queries = [];
  const command = {
    and: (items) => ({ and: items }),
    or: (items) => ({ or: items }),
    gt: (value) => ({ gt: value }),
  };
  function matches(record, query) {
    if (query.and) return query.and.every((item) => matches(record, item));
    if (query.or) return query.or.some((item) => matches(record, item));
    return Object.entries(query).every(([key, expected]) => {
      if (expected && Object.hasOwn(expected, "gt")) return record[key] > expected.gt;
      return record[key] === expected;
    });
  }
  const db = {
    collection(name) {
      assert.equal(name, "records");
      let query;
      const ordering = [];
      return {
        where(value) {
          query = value;
          return this;
        },
        orderBy(field, direction) {
          ordering.push([field, direction]);
          return this;
        },
        limit(size) {
          assert.equal(size, 100);
          return this;
        },
        async get() {
          queries.push(query);
          assert.deepEqual(ordering, [
            ["date", "asc"],
            ["createdAt", "asc"],
            ["_id", "asc"],
          ]);
          return {
            data: records
              .filter((record) => matches(record, query))
              .sort(
                (left, right) =>
                  left.date.localeCompare(right.date) ||
                  left.createdAt - right.createdAt ||
                  left._id.localeCompare(right._id)
              )
              .slice(0, 100),
          };
        },
      };
    },
  };
  const filename = "cloudfunctions/tomatoLedger/handlers/analysis.handler.js";
  const source = fs.readFileSync(filename, "utf8");
  const module = { exports: {} };
  vm.runInNewContext(`${source}\nmodule.exports.getAnalysisRecords = getAnalysisRecords;`, {
    module,
    exports: module.exports,
    require(name) {
      if (name === "../shared/helpers") return { db, _: command };
      return {};
    },
  });
  return { getAnalysisRecords: module.exports.getAnalysisRecords, queries };
}

test("analysis cursor reads every row across page boundaries with duplicate dates and timestamps", async () => {
  const createdAt = new Date("2026-10-01T08:00:00Z");
  const records = Array.from({ length: 205 }, (_, index) => ({
    _id: String(index).padStart(4, "0"),
    ledgerId: "ledger-1",
    date: "2026-10-01",
    createdAt,
  }));
  records.push({ _id: "other", ledgerId: "ledger-2", date: "2026-10-01", createdAt });
  const { getAnalysisRecords, queries } = loadReader(records);
  const result = await getAnalysisRecords({ ledgerId: "ledger-1" });

  assert.equal(result.length, 205);
  assert.equal(new Set(result.map((record) => record._id)).size, 205);
  assert.equal(result[0]._id, "0000");
  assert.equal(result.at(-1)._id, "0204");
  assert.equal(queries.length, 3);
});
