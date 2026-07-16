const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveEnvironment } = require("../miniprogram/config/cloud-env");
test("cloud environment selects test outside release", () => {
  assert.equal(resolveEnvironment("develop").key, "test");
  assert.equal(resolveEnvironment("trial").key, "test");
});
test("cloud environment requires a production id for release", () => {
  assert.throws(() => resolveEnvironment("release"), /CLOUD_ENVIRONMENT_ID_MISSING:production/);
});
