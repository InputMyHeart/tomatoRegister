let pendingNavigation = null;

function logNavigation(stage, now) {
  const navigation = pendingNavigation;
  const elapsedMs = now - navigation.startedAt;
  const phaseMs =
    stage === "onReady" && navigation.loadedAt ? now - navigation.loadedAt : elapsedMs;
  console.info("[页面跳转耗时]", {
    from: navigation.from,
    to: navigation.to,
    stage,
    timestampMs: now,
    elapsedMs,
    phaseMs,
  });
}

function startNavigation(from, to) {
  pendingNavigation = { from, to, startedAt: Date.now(), loadedAt: 0 };
  logNavigation("点击", pendingNavigation.startedAt);
}

function markNavigation(to, stage) {
  if (!pendingNavigation || pendingNavigation.to !== to) return;
  const now = Date.now();
  if (stage === "onLoad") pendingNavigation.loadedAt = now;
  logNavigation(stage, now);
  if (stage === "onReady") pendingNavigation = null;
}

module.exports = { startNavigation, markNavigation };
