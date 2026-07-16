function assertObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error("INVALID_PAYLOAD");
    error.code = "INVALID_PAYLOAD";
    throw error;
  }
}
module.exports = { assertObject };
