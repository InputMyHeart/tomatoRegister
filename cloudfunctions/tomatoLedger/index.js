const cloud = require("wx-server-sdk");
const { success, failure } = require("./shared/response");
const { toFailure } = require("./shared/errors");
const { assertObject } = require("./validators/schemas");
const auth = require("./actions/auth");
const ledger = require("./actions/ledger");
const record = require("./actions/record");
const category = require("./actions/category");
const invite = require("./actions/invite");
const feedback = require("./actions/feedback");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const routes = {
  "auth/login": auth.login,
  "auth/profile/update": auth.updateProfile,
  "auth/database/reset": auth.resetDatabase,
  "ledger/create": ledger.create,
  "ledger/list": ledger.list,
  "ledger/current/set": ledger.setCurrent,
  "ledger/members/get": ledger.members,
  "ledger/members/remove": ledger.removeMember,
  "ledger/delete": ledger.remove,
  "ledger/dashboard/get": ledger.dashboard,
  "ledger/analysis/get": ledger.analysis,
  "ledger/budget/update": ledger.updateBudget,
  "ledger/quick-amounts/update": ledger.updateQuickAmounts,
  "ledger/accounts/update": ledger.updateAccounts,
  "record/create": record.create,
  "record/get": record.get,
  "record/list": record.list,
  "record/update": record.update,
  "record/delete": record.remove,
  "record/import": record.importRecords,
  "record/import/template": record.importTemplate,
  "category/list": category.list,
  "category/save": category.save,
  "category/delete": category.remove,
  "invite/create": invite.create,
  "invite/join-token": invite.joinByToken,
  "invite/join": invite.join,
  "invite/join-readonly": invite.joinReadonly,
  "feedback/create": feedback.create,
  "feedback/list": feedback.list,
};

function logRequest(fields) {
  console.info(JSON.stringify({ type: "tomatoLedger", ...fields }));
}

const sensitiveFieldPattern = /password|token|secret|credential|authorization|cookie|session|code/i;

function sanitizePayload(value, depth = 0) {
  if (typeof value === "string") return value.slice(0, 1000);
  if (value === null || typeof value !== "object") return value;
  if (depth >= 3) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizePayload(item, depth + 1));
  }
  return Object.keys(value)
    .slice(0, 30)
    .reduce((result, key) => {
      result[key] = sensitiveFieldPattern.test(key)
        ? "[REDACTED]"
        : sanitizePayload(value[key], depth + 1);
      return result;
    }, {});
}

async function writeErrorLog(fields) {
  try {
    await db.collection("errorLogs").add({
      data: { type: "tomatoLedgerError", occurredAt: new Date(), status: "failure", ...fields },
    });
  } catch (error) {
    console.warn("Failed to write tomatoLedger error log", error);
  }
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
  let openid;
  if (!handler) {
    logRequest({
      requestId,
      route,
      ledgerId,
      status: "failure",
      code: "ROUTE_NOT_FOUND",
      durationMs: Date.now() - startedAt,
    });
    try {
      ({ OPENID: openid } = cloud.getWXContext());
    } catch (error) {
      console.warn("Failed to get OpenID for tomatoLedger error log", error);
    }
    await writeErrorLog({
      requestId,
      route,
      openid,
      ledgerId,
      code: "ROUTE_NOT_FOUND",
      message: "Unknown route",
      durationMs: Date.now() - startedAt,
      payload: sanitizePayload(payload),
    });
    return failure("ROUTE_NOT_FOUND", "Unknown route");
  }
  try {
    assertObject(payload);
    ({ OPENID: openid } = cloud.getWXContext());
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
      const message = (result && result.message) || "Request failed";
      await writeErrorLog({
        requestId,
        route,
        openid,
        ledgerId,
        code,
        message,
        durationMs: Date.now() - startedAt,
        payload: sanitizePayload(payload),
      });
      return failure(code, message);
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
    if (!openid) {
      try {
        ({ OPENID: openid } = cloud.getWXContext());
      } catch (contextError) {
        console.warn("Failed to get OpenID for tomatoLedger error log", contextError);
      }
    }
    await writeErrorLog({
      requestId,
      route,
      openid,
      ledgerId,
      code: normalized.code,
      message: normalized.message,
      durationMs: Date.now() - startedAt,
      payload: sanitizePayload(payload),
      ...(typeof error.stack === "string" ? { stack: error.stack.slice(0, 4000) } : {}),
    });
    return failure(normalized.code, normalized.message);
  }
};
