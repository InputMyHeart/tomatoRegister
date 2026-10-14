const assert = require("node:assert/strict");
const test = require("node:test");
const feedback = require("../miniprogram/services/feedback-ui");

test("overlapping loading requests keep the newest message and restore the previous request", () => {
  feedback.clearFeedback();
  const snapshots = [];
  const unsubscribe = feedback.subscribe((snapshot) => snapshots.push(snapshot));

  const first = feedback.showLoading({ message: "正在准备模板…" });
  const second = feedback.showLoading({ message: "正在下载模板…" });
  assert.equal(feedback.getSnapshot().loading.message, "正在下载模板…");

  assert.equal(feedback.updateLoading(first, { message: "正在解析…" }), true);
  assert.equal(feedback.getSnapshot().loading.message, "正在下载模板…");
  assert.equal(feedback.hideLoading(second), true);
  assert.equal(feedback.getSnapshot().loading.message, "正在解析…");
  assert.equal(feedback.hideLoading(first), true);
  assert.equal(feedback.getSnapshot().loading, null);
  assert.equal(feedback.hideLoading(first), false);
  assert.ok(snapshots.length >= 5);

  unsubscribe();
  feedback.clearFeedback();
});

test("toast supports warning, replaces the current prompt, and clears it", () => {
  feedback.clearFeedback();
  assert.equal(feedback.showToast({ type: "warning", message: "部分记录未导入" }), true);
  assert.deepEqual(feedback.getSnapshot().toast, {
    type: "warning",
    message: "部分记录未导入",
  });

  assert.equal(feedback.showToast({ type: "error", message: "导入失败" }), true);
  assert.deepEqual(feedback.getSnapshot().toast, {
    type: "error",
    message: "导入失败",
  });
  assert.equal(feedback.showToast({ message: "  " }), false);
  assert.equal(feedback.getSnapshot().toast.message, "导入失败");
  feedback.hideToast();
  assert.equal(feedback.getSnapshot().toast, null);
});
