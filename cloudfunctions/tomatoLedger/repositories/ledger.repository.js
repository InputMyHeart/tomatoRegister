function createLedgerRepository(db) {
  return { findById: async (id) => (await db.collection("ledgers").doc(id).get()).data || null };
}
module.exports = { createLedgerRepository };
