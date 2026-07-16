function toFailure(error) {
  return { code: error.code || error.message || "INTERNAL_ERROR", message: "Request failed" };
}
module.exports = { toFailure };
