const app = getApp();
const feedbackService = require("../../services/feedback.service");

const MAX_IMAGES = 9;
const MAX_CONTENT_LENGTH = 200;

Page({
  data: {
    content: "",
    contentLength: 0,
    type: "",
    images: [],
    imageCount: 0,
    saving: false,
    typeOptions: [
      { value: "feature", label: "需求反馈" },
      { value: "bug", label: "BUG反馈" },
      { value: "improvement", label: "优化反馈" },
      { value: "other", label: "其他" },
    ],
  },
  onLoad() {
    if (!app.globalData.loggedIn) wx.reLaunch({ url: "/pages/login/index" });
  },
  onContentInput(event) {
    const content = event.detail.value || "";
    this.setData({ content, contentLength: Array.from(content).length });
  },
  selectType(event) {
    this.setData({ type: event.currentTarget.dataset.value || "" });
  },
  async chooseImages() {
    const remaining = MAX_IMAGES - this.data.images.length;
    if (remaining <= 0) return;
    try {
      const result = await wx.chooseMedia({
        count: remaining,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
      });
      const selected = (result.tempFiles || []).map((item) => item.tempFilePath).filter(Boolean);
      const images = [...this.data.images, ...selected].slice(0, MAX_IMAGES);
      this.setData({ images, imageCount: images.length });
    } catch (error) {
      if (!String(error.errMsg || error.message || "").includes("cancel")) {
        wx.showToast({ title: "选择图片失败", icon: "none" });
      }
    }
  },
  removeImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    const images = this.data.images.filter((_item, currentIndex) => currentIndex !== index);
    this.setData({ images, imageCount: images.length });
  },
  previewImage(event) {
    wx.previewImage({ current: event.currentTarget.dataset.src, urls: this.data.images });
  },
  async uploadImages() {
    return Promise.all(
      this.data.images.map((filePath, index) =>
        wx.cloud
          .uploadFile({
            cloudPath: `feedback/${app.globalData.openid || "user"}/${Date.now()}-${index}.jpg`,
            filePath,
          })
          .then((result) => {
            if (!result.fileID) throw new Error("图片上传失败");
            return result.fileID;
          })
      )
    );
  },
  async submitFeedback() {
    const content = this.data.content.trim();
    if (!content) {
      wx.showToast({ title: "请填写反馈内容", icon: "none" });
      return;
    }
    if (!this.data.type) {
      wx.showToast({ title: "请选择反馈类型", icon: "none" });
      return;
    }
    if (Array.from(content).length > MAX_CONTENT_LENGTH || this.data.saving) return;
    this.setData({ saving: true });
    try {
      const images = await this.uploadImages();
      await feedbackService.createFeedback({ content, type: this.data.type, images });
      wx.redirectTo({ url: "/pages/feedback-history/index" });
    } catch (error) {
      wx.showToast({ title: error.message || "提交失败，请重试", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },
  openHistory() {
    wx.navigateTo({ url: "/pages/feedback-history/index" });
  },
});
