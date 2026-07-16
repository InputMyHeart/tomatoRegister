function success(data = {}) {
  return { ok: true, data };
}
function failure(code, message) {
  return { ok: false, error: { code, message } };
}
module.exports = { success, failure };
