function canRead(role) {
  return ["owner", "member", "readonly"].includes(role);
}
function canWrite(role) {
  return ["owner", "member"].includes(role);
}
function isOwner(role) {
  return role === "owner";
}
module.exports = { canRead, canWrite, isOwner };
