const app = getApp();

const defaultAvatar = "/images/brand/tomato-ledger-logo-256-transparent.png";

Page({
  data: {
    avatarUrl: defaultAvatar,
    isDefaultAvatar: true,
    nickName: "",

    saving: false,
  },

  onLoad() {
    const user = app.globalData.user;
    if (!user) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }

    const avatarUrl = user.avatarUrl || defaultAvatar;

    this.setData({
      avatarUrl,
      isDefaultAvatar: avatarUrl === defaultAvatar,
      nickName: user.nickName || "",
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
    try {
      const avatarUrl = await this.uploadAvatarIfNeeded(this.data.avatarUrl);
      await app.updateProfile({
        avatarUrl,
        nickName,
      });
      wx.showToast({ title: "已保存", icon: "success" });
      setTimeout(() => wx.navigateBack(), 350);
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
