const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const template = fs.readFileSync("miniprogram/components/tl-button/index.wxml", "utf8");
const source = fs.readFileSync("miniprogram/components/tl-button/index.js", "utf8");
let definition;
vm.runInNewContext(source, {
  Component(config) {
    definition = config;
  },
});

test("tl-button stops the native tap and forwards one component event", () => {
  assert.match(template, /<button[^>]*catchtap="handleTap"/);
  assert.doesNotMatch(template, /<button[^>]*bindtap="handleTap"/);

  const events = [];
  definition.methods.handleTap.call({
    data: { disabled: false, loading: false },
    triggerEvent(name) {
      events.push(name);
    },
  });
  assert.deepEqual(events, ["tap"]);
});

test("tl-button does not forward taps while disabled or loading", () => {
  for (const data of [
    { disabled: true, loading: false },
    { disabled: false, loading: true },
  ]) {
    let count = 0;
    definition.methods.handleTap.call({
      data,
      triggerEvent() {
        count += 1;
      },
    });
    assert.equal(count, 0);
  }
});
