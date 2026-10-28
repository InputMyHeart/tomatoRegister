const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function load(file, mocks = {}, app = { globalData: {} }, wx = {}) {
  const filename = path.resolve(file);
  const realRequire = createRequire(filename);
  const module = { exports: {} };
  let definition;
  vm.runInNewContext(
    fs.readFileSync(filename, "utf8"),
    {
      module,
      exports: module.exports,
      require: (name) => (Object.hasOwn(mocks, name) ? mocks[name] : realRequire(name)),
      getApp: () => app,
      wx,
      console: { warn() {}, error() {} },
      App: (value) => {
        definition = value;
      },
      Page: (value) => {
        definition = value;
      },
      Component: (value) => {
        definition = value;
      },
      setTimeout,
      clearTimeout,
    },
    { filename }
  );
  return definition || module.exports;
}
function instance(definition) {
  return {
    ...definition,
    ...definition.methods,
    data: structuredClone(definition.data),
    isAttached: true,
    recordsRequestId: 0,
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
}
function storageApi() {
  const storage = {};
  return {
    storage,
    wx: {
      getStorageSync: (key) => storage[key],
      setStorageSync: (key, value) => {
        storage[key] = structuredClone(value);
      },
      removeStorageSync: (key) => {
        delete storage[key];
      },
    },
  };
}

function recordsComponent(service) {
  return instance(
    load("miniprogram/components/tl-tab-records/index.js", {
      "../../services/record.service": service,
      "../../utils/avatar": { resolveAvatarUrls: async (rows) => rows },
    })
  );
}

test("partial record pages preserve server totals, cursor and records beyond 50", async () => {
  const calls = [];
  const component = recordsComponent({
    listRecords: async (payload) => {
      calls.push(payload);
      const start = payload.cursor ? 30 : 0;
      return {
        records: Array.from({ length: 30 }, (_, i) => ({
          _id: String(start + i),
          type: "expense",
          amount: 1,
          date: "2026-10-24",
        })),
        rangeSummary: { income: 2000, expense: 1234.56 },
        rangeRecordCount: 71,
        historyRecordCount: 240,
        hasMore: true,
        nextCursor: { date: "2026-10-24", id: String(start + 29) },
      };
    },
  });
  component.data.ledgerId = "shared";
  component.data.currentRange = { start: "2026-10-01", end: "2026-11-01" };
  await component.loadRecords();
  assert.equal(component.data.monthExpense, "1234.56");
  assert.equal(component.data.monthRecordCount, 71);
  assert.equal(component.data.hasMore, true);
  await component.loadRecords(component.data.currentRange, true);
  assert.equal(component.data.records.length, 60);
  assert.equal(component.data.monthExpense, "1234.56");
  assert.equal(calls[1].cursor.id, "29");
  await component.refreshRecords();
  assert.equal(calls.length, 3);
  assert.equal(component.data.ledgerId, "shared");
  assert.equal(component.data.monthRecordCount, 71);
});

test("an old record month response cannot overwrite a newly selected month", async () => {
  const pending = [deferred(), deferred()];
  let i = 0;
  const component = recordsComponent({ listRecords: () => pending[i++].promise });
  component.data.ledgerId = "ledger";
  const first = component.loadRecords({ start: "2026-10-01", end: "2026-11-01" });
  const second = component.loadRecords({ start: "2026-11-01", end: "2026-12-01" });
  pending[1].resolve({ records: [], rangeSummary: { expense: 20 }, rangeRecordCount: 2 });
  await second;
  pending[0].resolve({ records: [], rangeSummary: { expense: 10 }, rangeRecordCount: 1 });
  await first;
  assert.equal(component.data.monthExpense, "20");
  assert.equal(component.data.monthRecordCount, 2);
});

test("analysis and record list requery cloud without persisting results", async () => {
  let requests = 0;
  const api = { callApi: async () => ({ value: ++requests }) };
  const ledger = load("miniprogram/services/ledger.service.js", { "./api": api });
  assert.equal((await ledger.getAnalysis({ ledgerId: "a", anchor: "2026-10" })).value, 1);
  assert.equal((await ledger.getAnalysis({ ledgerId: "a", anchor: "2026-10" })).value, 2);
  const records = load("miniprogram/services/record.service.js", { "./api": api });
  assert.equal((await records.listRecords({ ledgerId: "a" })).value, 3);
});

test("request transport failure is marked as an unknown write outcome", async () => {
  const api = load(
    "miniprogram/services/api.js",
    { "../utils/performance": { logPerformance() {} } },
    { globalData: {} },
    { cloud: { callFunction: async () => Promise.reject(new Error("network interrupted")) } }
  );
  await assert.rejects(api.callApi("record/create", {}), (error) => {
    assert.equal(error.deliveryUnknown, true);
    return true;
  });
});

test("server response failure remains a known result", async () => {
  const api = load(
    "miniprogram/services/api.js",
    { "../utils/performance": { logPerformance() {} } },
    { globalData: {} },
    {
      cloud: {
        callFunction: async () => ({
          result: { ok: false, error: { code: "INVALID_RECORD_AMOUNT", message: "金额无效" } },
        }),
      },
    }
  );
  await assert.rejects(api.callApi("record/create", {}), (error) => {
    assert.equal(error.code, "INVALID_RECORD_AMOUNT");
    assert.equal(error.deliveryUnknown, undefined);
    return true;
  });
});

test("saving waits for cloud; a failed save preserves input and supports retry", async () => {
  let request = deferred();
  let navigations = 0;
  const toasts = [];
  const page = instance(
    load(
      "miniprogram/pages/record-edit/index.js",
      {
        "../../services/record.service": { createRecord: () => request.promise },
        "../../services/feedback-ui": { showToast: (value) => toasts.push(value) },
      },
      { globalData: {} },
      {
        navigateBack: () => {
          navigations++;
        },
      }
    )
  );
  Object.assign(page.data, { ledgerId: "a", amount: "39", note: "午饭" });
  const failed = page.saveRecord();
  assert.equal(navigations, 0);
  assert.equal(toasts.length, 0);
  request.reject(new Error("offline"));
  await failed;
  assert.equal(page.data.note, "午饭");
  assert.equal(page.data.amount, "39");
  assert.equal(page.data.saving, false);
  assert.equal(navigations, 0);
  request = deferred();
  const retry = page.saveRecord();
  request.resolve({ recordId: "real" });
  await retry;
  assert.equal(navigations, 1);
  assert.equal(toasts.at(-1).type, "success");
});

test("unknown save result keeps the draft and asks for cloud record verification", async () => {
  const toasts = [];
  const error = new Error("network interrupted");
  error.deliveryUnknown = true;
  const page = instance(
    load(
      "miniprogram/pages/record-edit/index.js",
      {
        "../../services/record.service": { createRecord: async () => Promise.reject(error) },
        "../../services/feedback-ui": { showToast: (value) => toasts.push(value) },
      },
      { globalData: {} },
      { navigateBack: () => assert.fail("unknown result must not navigate") }
    )
  );
  Object.assign(page.data, { ledgerId: "a", amount: "39", note: "午饭" });
  await page.saveRecord();
  assert.equal(page.data.note, "午饭");
  assert.equal(page.data.saving, false);
  assert.match(toasts.at(-1).message, /结果未确认.*明细核对/);
});

test("deletion waits for cloud and remains on page when rejected", async () => {
  const request = deferred();
  let navigations = 0;
  const page = instance(
    load(
      "miniprogram/pages/record-edit/index.js",
      {
        "../../services/record.service": { deleteRecord: () => request.promise },
        "../../services/feedback-ui": { showToast() {} },
      },
      { globalData: {} },
      {
        showModal: (options) => options.success({ confirm: true }),
        navigateBack: () => {
          navigations++;
        },
      }
    )
  );
  Object.assign(page.data, { isEditing: true, recordId: "record", ledgerId: "a" });
  const deletion = page.deleteRecord();
  await Promise.resolve();
  assert.equal(navigations, 0);
  request.reject(new Error("offline"));
  await deletion;
  assert.equal(navigations, 0);
  assert.equal(page.data.deleting, false);
});

test("category memory is scoped and a previous login request cannot repopulate storage", async () => {
  const { storage, wx } = storageApi();
  const app = { globalData: { openid: "first", environment: { key: "test" } } };
  let request = deferred();
  const categories = load(
    "miniprogram/services/category.store.js",
    {
      "./api": { callApi: () => request.promise },
    },
    app,
    wx
  );
  const initial = categories.refreshCategories("shared");
  request.resolve({ categories: [{ _id: "old" }] });
  await initial;
  assert.equal(categories.getCategoriesSync("shared")[0]._id, "old");
  request = deferred();
  const stale = categories.refreshCategories("shared");
  categories.clearAll();
  app.globalData.openid = "second";
  assert.equal(categories.getCategoriesSync("shared").length, 0);
  request.resolve({ categories: [{ _id: "old-response" }] });
  await assert.rejects(stale, /状态已变化/);
  assert.equal(storage.tomatoLedgerCategoryCache, undefined);
});

test("category invalidation and deletion do not retain stale memory", async () => {
  const { wx } = storageApi();
  const app = { globalData: { openid: "user", environment: { key: "test" } } };
  let count = 0;
  const categories = load(
    "miniprogram/services/category.store.js",
    {
      "./api": { callApi: async () => ({ categories: [{ _id: String(++count) }] }) },
    },
    app,
    wx
  );
  await categories.getCategories("shared");
  assert.equal(categories.getCategoriesSync("shared")[0]._id, "1");
  categories.invalidate("shared");
  await categories.refreshCategories("shared", { force: true });
  assert.equal(categories.getCategoriesSync("shared")[0]._id, "2");
  categories.removeLedger("shared");
  assert.equal(categories.getCategoriesSync("shared").length, 0);
});

function syncService(refreshCategories) {
  const app = {
    authGeneration: 0,
    globalData: {
      openid: "user",
      loggedIn: true,
      environment: { key: "test" },
      currentLedger: { _id: "shared" },
      dataSyncedAt: 0,
    },
    loginWithWechat: async () => {},
  };
  const calls = [];
  const service = load(
    "miniprogram/services/data-sync.service.js",
    {
      "./ledger.store": {
        syncLedgers: async (options) => {
          calls.push(options);
          return { changed: false };
        },
      },
      "./category.store": { invalidateAll: () => calls.push("invalidate"), refreshCategories },
    },
    app
  );
  return { app, service, calls };
}

test("manual sync with unchanged revisions still awaits categories and shares in-flight work", async () => {
  const request = deferred();
  let count = 0;
  const { app, service, calls } = syncService(() => {
    count++;
    return request.promise;
  });
  const first = service.syncData();
  const second = service.syncData();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(count, 1);
  assert.equal(app.globalData.dataSyncedAt, 0);
  assert.equal(calls[0].force, true);
  request.resolve([]);
  await Promise.all([first, second]);
  assert.ok(app.globalData.dataSyncedAt > 0);
});

test("manual sync failure or logout cannot report a successful timestamp", async () => {
  const failure = syncService(async () => {
    throw new Error("offline");
  });
  await assert.rejects(failure.service.syncData(), /offline/);
  assert.equal(failure.app.globalData.dataSyncedAt, 0);
  const request = deferred();
  const logout = syncService(() => request.promise);
  const pending = logout.service.syncData();
  await new Promise((resolve) => setImmediate(resolve));
  logout.app.authGeneration++;
  logout.app.globalData.openid = "";
  request.resolve([]);
  await assert.rejects(pending, /登录状态已变化/);
  assert.equal(logout.app.globalData.dataSyncedAt, 0);
});

test("logout invalidates a pending login and persisted auth excludes ledger/stat copies", async () => {
  const { wx, storage } = storageApi();
  const request = deferred();
  const app = load(
    "miniprogram/app.js",
    {
      "./services/profile.service": { login: () => request.promise },
      "./services/ledger.store": { clearLedgers() {} },
      "./services/category.store": { clearAll() {} },
    },
    undefined,
    wx
  );
  app.globalData = {
    openid: "user",
    user: { currentLedgerId: "a" },
    currentLedger: { _id: "a" },
    stats: { recordCount: 71 },
    environment: { key: "test" },
  };
  app.persistAuthState();
  assert.equal(storage.tomatoLedgerAuth.currentLedger, undefined);
  assert.equal(storage.tomatoLedgerAuth.stats, undefined);
  const login = app.loginWithWechat();
  app.logout();
  request.resolve({ openid: "user", user: {} });
  await assert.rejects(login, /登录状态已变化/);
  assert.equal(app.globalData.loggedIn, false);
  assert.equal(storage.tomatoLedgerAuth, undefined);
});

test("shared ledger revisions invalidate categories and removed ledgers clear categories", async () => {
  const { wx } = storageApi();
  const app = { globalData: { openid: "user", environment: { key: "test" } } };
  const invalidated = [],
    removed = [];
  const store = load(
    "miniprogram/services/ledger.store.js",
    {
      "./ledger.service": {
        syncLedgers: async () => ({
          changed: true,
          changedLedgerIds: ["shared"],
          removedLedgerIds: ["removed"],
          ledgers: [{ _id: "shared", ownerOpenid: "user", syncRevision: 2 }],
          currentLedgerId: "shared",
        }),
      },
      "./category.store": {
        invalidate: (id) => invalidated.push(id),
        removeLedger: (id) => removed.push(id),
      },
    },
    app,
    wx
  );
  await store.syncLedgers({ force: true });
  assert.deepEqual(invalidated, ["shared"]);
  assert.deepEqual(removed, ["removed"]);
  assert.equal(app.globalData.currentLedger._id, "shared");
});

test("logout rejects pending ledger reads without restoring their cache", async () => {
  const { wx, storage } = storageApi();
  const app = { globalData: { openid: "user", environment: { key: "test" } } };
  const request = deferred();
  const store = load(
    "miniprogram/services/ledger.store.js",
    {
      "./ledger.service": { listLedgers: () => request.promise },
      "./category.store": {},
    },
    app,
    wx
  );
  const pending = store.refreshLedgers();
  store.clearLedgers();
  request.resolve({ ledgers: [{ _id: "old" }] });
  await assert.rejects(pending, /登录状态已变化/);
  assert.equal(storage.tomatoLedgerLedgerCache, undefined);
});
