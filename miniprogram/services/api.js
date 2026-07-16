function toError(result = {}, route) {
  const error = new Error(result.message || "请求失败");
  error.code = result.code || "REQUEST_FAILED";
  error.route = route;
  return error;
}
async function callApi(route, payload = {}) {
  if (!wx.cloud || !wx.cloud.callFunction) throw new Error("云能力不可用");
  try {
    const response = await wx.cloud.callFunction({
      name: "tomatoLedger",
      data: { route, payload },
    });
    const result = response.result || {};
    if (!result.ok) throw toError(result.error || result, route);
    return result.data || {};
  } catch (error) {
    console.error("tomatoLedger request failed", route, error);
    throw error;
  }
}
module.exports = { callApi };
