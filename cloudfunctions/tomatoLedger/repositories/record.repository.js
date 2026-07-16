function createRecordRepository(db) {
  return { findById: async (id) => (await db.collection("records").doc(id).get()).data || null };
}
module.exports = { createRecordRepository };
