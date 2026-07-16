function requireLogin(app) {
  if (app.globalData.loggedIn) return Promise.resolve();
  return app.loginWithWechat();
}

function redirectToLogin() {
  wx.reLaunch({ url: "/pages/login/index" });
}

module.exports = { requireLogin, redirectToLogin };
