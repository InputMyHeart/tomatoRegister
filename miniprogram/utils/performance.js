function logPerformance(area, phase, startedAt, status = "success") {
  let app;
  try {
    app = typeof getApp === "function" ? getApp() : null;
  } catch (_error) {
    return;
  }
  const environment = app && app.globalData && app.globalData.environment;
  if (!environment || environment.key !== "test" || !Number.isFinite(startedAt)) return;
  console.info("[性能采样]", {
    area,
    phase,
    status,
    durationMs: Math.max(0, Date.now() - startedAt),
  });
}

module.exports = { logPerformance };
