const test = require("node:test");
const assert = require("node:assert/strict");

const ledgerServicePath = require.resolve("../miniprogram/services/ledger.service");
const ledgerStorePath = require.resolve("../miniprogram/services/ledger.store");

function loadLedgerStore(
  listLedgers,
  syncLedgers = async () => ({ changed: false, revisions: {} }),
  serviceOverrides = {}
) {
  const storage = {};
  const app = {
    globalData: {
      environment: { key: "test" },
      openid: "user-1",
      ledgers: [],
    },
  };
  global.wx = {
    getStorageSync(key) {
      return storage[key];
    },
    setStorageSync(key, value) {
      storage[key] = value;
    },
    removeStorageSync(key) {
      delete storage[key];
    },
  };
  global.getApp = () => app;
  require.cache[ledgerServicePath] = {
    id: ledgerServicePath,
    filename: ledgerServicePath,
    loaded: true,
    exports: { listLedgers, syncLedgers, ...serviceOverrides },
  };
  delete require.cache[ledgerStorePath];
  return { ledgerStore: require(ledgerStorePath), app, storage };
}

test("forced ledger refresh retries after an in-flight stale request", async () => {
  let callCount = 0;
  let resolveFirstRequest;
  const firstRequest = new Promise((resolve) => {
    resolveFirstRequest = resolve;
  });
  const { ledgerStore, app, storage } = loadLedgerStore(() => {
    callCount += 1;
    if (callCount === 1) return firstRequest;
    return Promise.resolve({ ledgers: [{ _id: "fresh", name: "新账本" }] });
  });

  const staleRefresh = ledgerStore.refreshLedgers();
  const forcedRefresh = ledgerStore.refreshLedgers({ force: true });
  resolveFirstRequest({ ledgers: [{ _id: "stale", name: "旧账本" }] });

  assert.deepEqual(await staleRefresh, [{ _id: "stale", name: "旧账本" }]);
  assert.deepEqual(await forcedRefresh, [{ _id: "fresh", name: "新账本" }]);
  assert.equal(callCount, 2);
  assert.deepEqual(app.globalData.ledgers, [{ _id: "fresh", name: "新账本" }]);
  assert.deepEqual(storage.tomatoLedgerLedgerCache.ledgers, [{ _id: "fresh", name: "新账本" }]);
});

test("ledger reads fetch only when no scoped cache record exists", async () => {
  let callCount = 0;
  const first = loadLedgerStore(() => {
    callCount += 1;
    return Promise.resolve({ ledgers: [{ _id: "server" }] });
  });

  assert.deepEqual(await first.ledgerStore.getLedgers(), [{ _id: "server" }]);
  assert.equal(callCount, 1);
  assert.deepEqual(await first.ledgerStore.getLedgers(), [{ _id: "server" }]);
  assert.equal(callCount, 1);

  const second = loadLedgerStore(() => {
    callCount += 1;
    return Promise.resolve({ ledgers: [{ _id: "unexpected" }] });
  });
  second.storage.tomatoLedgerLedgerCache = {
    scope: "test:user-1",
    ledgers: [],
    updatedAt: Date.now(),
  };

  assert.deepEqual(await second.ledgerStore.getLedgers(), []);
  assert.equal(callCount, 1);
});

test("ledger sync respects TTL and updates cache only when revisions change", async () => {
  let syncCount = 0;
  const { ledgerStore, app, storage } = loadLedgerStore(
    async () => ({ ledgers: [] }),
    async () => {
      syncCount += 1;
      return {
        changed: true,
        changedLedgerIds: ["shared-1"],
        removedLedgerIds: [],
        revisions: { "shared-1": 2 },
        currentLedgerId: "shared-1",
        ledgers: [{ _id: "shared-1", name: "共享账本", syncRevision: 2, ownerOpenid: "owner" }],
      };
    }
  );
  storage.tomatoLedgerLedgerCache = {
    scope: "test:user-1",
    ledgers: [{ _id: "shared-1", name: "旧名称", syncRevision: 1 }],
    revisions: { "shared-1": 1 },
    lastSyncedAt: Date.now(),
  };

  assert.equal((await ledgerStore.syncLedgers()).checked, false);
  assert.equal(syncCount, 0);
  const result = await ledgerStore.syncLedgers({ force: true });
  assert.equal(result.changed, true);
  assert.equal(syncCount, 1);
  assert.equal(storage.tomatoLedgerLedgerCache.ledgers[0].name, "共享账本");
  assert.equal(app.globalData.currentLedger._id, "shared-1");
});

test("ledger edit keeps cache current when the post-mutation sync fails", async () => {
  const { ledgerStore, app, storage } = loadLedgerStore(
    async () => ({ ledgers: [] }),
    async () => {
      throw new Error("SYNC_FAILED");
    },
    {
      updateLedger: async ({ ledgerId, name, remark }) => ({
        ledger: {
          _id: ledgerId,
          name,
          remark,
          syncRevision: 2,
          ownerOpenid: "user-1",
        },
      }),
    }
  );
  storage.tomatoLedgerLedgerCache = {
    scope: "test:user-1",
    ledgers: [
      {
        _id: "ledger-1",
        name: "旧名称",
        remark: "旧备注",
        syncRevision: 1,
        ownerOpenid: "user-1",
      },
    ],
    revisions: { "ledger-1": 1 },
    lastSyncedAt: Date.now(),
  };
  app.globalData.currentLedger = storage.tomatoLedgerLedgerCache.ledgers[0];

  await ledgerStore.updateLedger({
    ledgerId: "ledger-1",
    name: "新名称",
    remark: "新备注",
  });

  assert.equal(storage.tomatoLedgerLedgerCache.ledgers[0].name, "新名称");
  assert.equal(storage.tomatoLedgerLedgerCache.ledgers[0].remark, "新备注");
  assert.equal(storage.tomatoLedgerLedgerCache.revisions["ledger-1"], 2);
  assert.equal(storage.tomatoLedgerLedgerCache.lastSyncedAt, 0);
  assert.equal(app.globalData.currentLedger.name, "新名称");
});
