const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createPage(saveCategory) {
  let definition;
  const toasts = [];
  const source = fs.readFileSync("miniprogram/pages/category-operation/index.js", "utf8");
  vm.runInNewContext(source, {
    getApp: () => ({ globalData: { currentLedger: {} } }),
    require: (modulePath) =>
      modulePath.includes("feedback-ui")
        ? { showToast: (options) => toasts.push(options) }
        : {
            saveCategory,
            listCategories: async () => ({ categories: [], role: "owner" }),
          },
    Page: (config) => {
      definition = config;
    },
  });
  const page = {
    ...definition,
    data: {
      ...definition.data,
      ledgerId: "ledger-1",
      level: "parent",
      showEditor: true,
      draftName: "餐饮",
      draftIcon: "restaurant-line",
    },
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  return { page, toasts };
}

for (const level of ["parent", "child"]) {
  test(`category ${level} save ignores a second event while pending`, async () => {
    let finish;
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    const calls = [];
    const { page } = createPage((payload) => {
      calls.push(payload);
      return pending;
    });
    page.data.level = level;
    page.data.parentId = level === "child" ? "parent-1" : "";

    const first = page.saveEditor();
    const second = page.saveEditor();
    assert.equal(calls.length, 1);
    assert.equal(page.data.saving, true);
    assert.equal(page.data.showEditor, true);
    page.closeEditor();
    assert.equal(page.data.showEditor, true);

    finish();
    await Promise.all([first, second]);
    assert.equal(calls[0].level, level);
    assert.equal(calls[0].parentId, page.data.parentId);
    assert.equal(page.data.saving, false);
    assert.equal(page.data.showEditor, false);
  });
}

test("category save failure keeps editor open and allows retry", async () => {
  let calls = 0;
  const { page, toasts } = createPage(async () => {
    calls += 1;
    if (calls === 1) throw new Error("网络错误");
  });

  await page.saveEditor();
  assert.equal(page.data.saving, false);
  assert.equal(page.data.showEditor, true);
  assert.equal(toasts[0].type, "error");
  assert.equal(toasts[0].message, "网络错误");

  await page.saveEditor();
  assert.equal(calls, 2);
  assert.equal(page.data.showEditor, false);
});
