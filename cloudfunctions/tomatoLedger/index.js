const cloud = require("wx-server-sdk");
const { success, failure } = require("./shared/response");
const { toFailure } = require("./shared/errors");
const { assertObject } = require("./validators/schemas");
const auth = require("./actions/auth");
const ledger = require("./actions/ledger");
const record = require("./actions/record");
const category = require("./actions/category");
const invite = require("./actions/invite");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const routes = {
  "auth/login": auth.login,
  "auth/profile/update": auth.updateProfile,
  "auth/database/reset": auth.resetDatabase,
  "ledger/create": ledger.create,
  "ledger/list": ledger.list,
  "ledger/current/set": ledger.setCurrent,
  "ledger/delete": ledger.remove,
  "ledger/dashboard/get": ledger.dashboard,
  "ledger/budget/update": ledger.updateBudget,
  "ledger/month-start/update": ledger.updateMonthStartDay,
  "record/create": record.create,
  "record/get": record.get,
  "record/list": record.list,
  "record/update": record.update,
  "record/delete": record.remove,
  "category/list": category.list,
  "category/save": category.save,
  "category/delete": category.remove,
  "invite/create": invite.create,
  "invite/join-token": invite.joinByToken,
  "invite/join": invite.join,
  "invite/join-readonly": invite.joinReadonly,
};

function logRequest(fields) {
  console.info(JSON.stringify({ type: "tomatoLedger", ...fields }));
}

exports.main = async (event = {}) => {
  const startedAt = Date.now();
  const requestId = String(
    event.requestId || "req_" + startedAt + "_" + Math.random().toString(36).slice(2, 8)
  );
  const route = String(event.route || "");
  const payload = event.payload || {};
  const handler = routes[route];
  const ledgerId = String(payload.ledgerId || "");
  if (!handler) {
    logRequest({
      requestId,
      route,
      ledgerId,
      status: "failure",
      code: "ROUTE_NOT_FOUND",
      durationMs: Date.now() - startedAt,
    });
    return failure("ROUTE_NOT_FOUND", "Unknown route");
  }
  try {
    assertObject(payload);
    const { OPENID: openid } = cloud.getWXContext();
    const result = await handler({ openid, route, requestId }, payload);
    if (!result || !result.success) {
      const code = (result && result.code) || "REQUEST_FAILED";
      logRequest({
        requestId,
        route,
        openid,
        ledgerId,
        status: "failure",
        code,
        durationMs: Date.now() - startedAt,
      });
      return failure(code, (result && result.message) || "Request failed");
    }
    logRequest({
      requestId,
      route,
      openid,
      ledgerId,
      status: "success",
      durationMs: Date.now() - startedAt,
    });
    return success(result.data || {});
  } catch (error) {
    const normalized = toFailure(error);
    console.error(
      JSON.stringify({
        type: "tomatoLedger",
        requestId,
        route,
        ledgerId,
        status: "failure",
        code: normalized.code,
        durationMs: Date.now() - startedAt,
        stack: error.stack,
      })
    );
    return failure(normalized.code, normalized.message);
  }
};
