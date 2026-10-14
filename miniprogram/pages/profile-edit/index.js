const feedback = require("../../services/feedback-ui");
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
      feedback.showToast({ type: "warning", message: "请输入昵称" });
      return;
    }

    this.setData({ saving: true });
    try {
      const avatarUrl = await this.uploadAvatarIfNeeded(this.data.avatarUrl);
      await app.updateProfile({
        avatarUrl,
        nickName,
      });
      feedback.showToast({ type: "success", message: "已保存" });
      setTimeout(() => {
        if (getCurrentPages().length > 1) {
          wx.navigateBack();
          return;
        }
        wx.reLaunch({ url: "/pages/index/index?tab=profile" });
      }, 350);
    } catch (error) {
      feedback.showToast({ type: "error", message: error.message || "保存失败" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
