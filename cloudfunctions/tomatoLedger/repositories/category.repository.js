function createCategoryRepository(db) {
  return { findById: async (id) => (await db.collection("categories").doc(id).get()).data || null };
}
module.exports = { createCategoryRepository };
