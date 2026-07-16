function getId(item = {}) {
  return item._id || item.id || "";
}

function getLedgerRole(openid, ledger = {}) {
  if (ledger.ownerOpenid === openid || ledger.role === "owner") return "owner";
  if (
    ledger.role === "readonly" ||
    ledger.readonly ||
    (ledger.viewerOpenids || []).includes(openid)
  )
    return "readonly";
  return "member";
}

function normalizeLedger(item = {}, openid = "") {
  const role = getLedgerRole(openid, item);
  return {
    ...item,
    id: getId(item),
    role,
    readonly: role === "readonly",
    memberCount: Array.isArray(item.memberOpenids) ? item.memberOpenids.length : 0,
    visitorCount: Array.isArray(item.viewerOpenids) ? item.viewerOpenids.length : 0,
  };
}

module.exports = { getId, getLedgerRole, normalizeLedger };
