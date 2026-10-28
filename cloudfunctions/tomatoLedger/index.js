const cloud = require("wx-server-sdk");
const { success, failure } = require("./shared/response");
const { toFailure } = require("./shared/errors");
const { assertObject } = require("./validators/schemas");
const { ensureCollections } = require("./shared/helpers");
const authHandler = require("./handlers/auth.handler");
const ledgerHandler = require("./handlers/ledger.handler");
const recordHandler = require("./handlers/record.handler");
const categoryHandler = require("./handlers/category.handler");
const dashboardHandler = require("./handlers/dashboard.handler");
const analysisHandler = require("./handlers/analysis.handler");
const budgetHandler = require("./handlers/budget.handler");
const settingsHandler = require("./handlers/settings.handler");
const feedback = require("./actions/feedback");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 包装：handler 统一接收 (openid, payload)，返回 { ok, data } 或抛错
function wrap(handler) {
  return async (context, payload) => {
    await ensureCollections();
    try {
      const result = await handler(context.openid, payload);
      if (result && result.success) return { success: true, data: result.data || {} };
      const code = (result && result.code) || "REQUEST_FAILED";
      const message = (result && result.message) || "Request failed";
      return { success: false, code, message };
    } catch (error) {
      const code = error.code || "INTERNAL_ERROR";
      const message = error.message || "Internal error";
      return { success: false, code, message };
    }
  };
}

const routes = {
  "auth/login": wrap(authHandler.login),
  "auth/profile/update": wrap(authHandler.updateProfile),
  "ledger/create": wrap(ledgerHandler.createLedger),
  "ledger/update": wrap(ledgerHandler.updateLedger),
  "ledger/list": wrap(ledgerHandler.listLedgers),
  "ledger/sync": wrap(ledgerHandler.syncLedgers),
  "ledger/current/set": wrap(ledgerHandler.setCurrentLedger),
  "ledger/members/get": wrap(ledgerHandler.getLedgerMembers),
  "ledger/members/remove": wrap(ledgerHandler.removeLedgerMember),
  "ledger/delete": wrap(ledgerHandler.deleteLedger),
  "ledger/dashboard/get": wrap(dashboardHandler.getDashboard),
  "ledger/analysis/get": wrap(analysisHandler.getAnalysis),
  "ledger/budget/update": wrap(budgetHandler.updateBudget),
  "ledger/quick-amounts/update": wrap(settingsHandler.updateQuickAmounts),
  "ledger/accounts/update": wrap(settingsHandler.updateAccounts),
  "record/create": wrap(recordHandler.createRecord),
  "record/get": wrap(recordHandler.getRecord),
  "record/list": wrap(recordHandler.listRecords),
  "record/update": wrap(recordHandler.updateRecord),
  "record/delete": wrap(recordHandler.deleteRecord),
  "record/import": wrap(recordHandler.importRecords),
  "record/import/template": wrap(recordHandler.getImportTemplate),
  "category/list": wrap(categoryHandler.listCategories),
  "category/save": wrap(categoryHandler.saveCategory),
  "category/delete": wrap(categoryHandler.removeCategory),
  "invite/create": wrap(ledgerHandler.createLedgerInviteToken),
  "invite/join-token": wrap(ledgerHandler.joinLedgerByInviteToken),
  "invite/join": wrap(ledgerHandler.joinLedger),
  "invite/join-readonly": wrap(ledgerHandler.joinReadonlyLedger),
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
