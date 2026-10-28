const { logPerformance } = require("../utils/performance");

function toError(result = {}, route) {
  const error = new Error(result.message || "请求失败");
  error.code = result.code || "REQUEST_FAILED";
  error.route = route;
  return error;
}
async function callApi(route, payload = {}) {
  if (!wx.cloud || !wx.cloud.callFunction) throw new Error("云能力不可用");
  const startedAt = Date.now();
  try {
    let response;
    try {
      response = await wx.cloud.callFunction({
        name: "tomatoLedger",
        data: { route, payload },
      });
    } catch (error) {
      const requestError = error instanceof Error ? error : new Error(String(error || "请求中断"));
      requestError.deliveryUnknown = true;
      throw requestError;
    }
    const result = response.result || {};
    if (!result.ok) throw toError(result.error || result, route);
    logPerformance(route, "client-request", startedAt);
    return result.data || {};
  } catch (error) {
    logPerformance(route, "client-request", startedAt, error.code || "failure");
    console.error("tomatoLedger request failed", route, error);
    throw error;
  }
}
module.exports = { callApi };
