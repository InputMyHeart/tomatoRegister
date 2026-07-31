const app = getApp();
const feedbackService = require("../../services/feedback.service");

const typeMap = { feature: "需求反馈", bug: "BUG反馈", improvement: "优化反馈", other: "其他" };
const statusMap = { submitted: "已反馈", processing: "处理中", resolved: "处理成功" };

function formatDate(value) {
  const date = value && value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page({
  data: { loading: true, isError: false, feedbacks: [] },
  onShow() {
    this.loadFeedbacks();
  },
  async loadFeedbacks() {
    if (!app.globalData.loggedIn) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.setData({ loading: true, isError: false });
    try {
      const data = await feedbackService.listFeedback();
      const feedbacks = (data.feedbacks || []).map((item) => ({
        ...item,
        id: item._id || item.id,
        typeText: typeMap[item.type] || "未分类",
        statusText: statusMap[item.status] || "已反馈",
        dateText: formatDate(item.createdAt),
        images: Array.isArray(item.images) ? item.images : [],
      }));
      this.setData({ feedbacks, loading: false });
    } catch (error) {
      this.setData({ loading: false, isError: true });
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },
  previewImage(event) {
    wx.previewImage({
      current: event.currentTarget.dataset.src,
      urls: event.currentTarget.dataset.urls,
    });
  },
});
