const app = getApp();

const defaultAvatar = "/images/brand/tomato-ledger-logo-256-transparent.png";
const genderOptions = ["喵星人", "男生", "女生"];

Page({
  data: {
    avatarUrl: defaultAvatar,
    isDefaultAvatar: true,
    nickName: "",
    gender: "喵星人",
    genderIndex: 0,
    genderOptions,
    saving: false,
  },

  onLoad() {
    const user = app.globalData.user;
    if (!user) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }

    const avatarUrl = user.avatarUrl || defaultAvatar;
    const gender = genderOptions.includes(user.gender) ? user.gender : "喵星人";
    this.setData({
      avatarUrl,
      isDefaultAvatar: avatarUrl === defaultAvatar,
      nickName: user.nickName || "",
      gender,
      genderIndex: Math.max(0, genderOptions.indexOf(gender)),
    });
  },

  onChooseAvatar(event) {
    const avatarUrl = event.detail && event.detail.avatarUrl;
    if (!avatarUrl) return;
    this.setData({ avatarUrl, isDefaultAvatar: avatarUrl === defaultAvatar });
  },

  onNickNameInput(event) {
    this.setData({ nickName: event.detail.value });
  },

  onGenderChange(event) {
    const genderIndex = Number(event.detail.value || 0);
    this.setData({
      genderIndex,
      gender: genderOptions[genderIndex] || "喵星人",
    });
  },

  async uploadAvatarIfNeeded(avatarUrl) {
    if (!avatarUrl || avatarUrl.startsWith("cloud://") || avatarUrl.startsWith("/images/"))
      return avatarUrl || defaultAvatar;

    let filePath = avatarUrl;
    if (avatarUrl.startsWith("http://127.0.0.1") || avatarUrl.startsWith("https://127.0.0.1")) {
      const imageInfo = await new Promise((resolve, reject) =>
        wx.getImageInfo({ src: avatarUrl, success: resolve, fail: reject })
      );
      filePath = imageInfo.path;
    }
    const cloudPath = `avatars/${app.globalData.openid || Date.now()}-${Date.now()}.png`;
    const res = await wx.cloud.uploadFile({ cloudPath, filePath });
    if (!res.fileID) throw new Error("头像上传失败，请重试");
    return res.fileID;
  },

  async saveProfile() {
    const nickName = this.data.nickName.trim();
    if (!nickName) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: "保存中" });
    try {
      const avatarUrl = await this.uploadAvatarIfNeeded(this.data.avatarUrl);
      await app.updateProfile({
        avatarUrl,
        nickName,
        gender: this.data.gender || "喵星人",
      });
      wx.showToast({ title: "已保存", icon: "success" });
      setTimeout(() => wx.navigateBack(), 350);
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ saving: false });
    }
  },
});
