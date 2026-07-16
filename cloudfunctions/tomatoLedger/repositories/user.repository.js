function createUserRepository(db) {
  return {
    findByOpenid: async (openid) =>
      (await db.collection("users").where({ openid }).limit(1).get()).data[0] || null,
  };
}
module.exports = { createUserRepository };
