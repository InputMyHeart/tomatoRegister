function toFailure(error) {
  const message = (error && (error.message || error.errMsg)) || "Request failed";
  return { code: (error && error.code) || "INTERNAL_ERROR", message };
}
module.exports = { toFailure };
