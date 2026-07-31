const app = getApp();
const recordService = require("../../services/record.service");
const accounts = ["微信", "支付宝", "银行卡", "现金"];
Page({
  data: {
    ledgerName: "当前账本",
    ledgerId: "",
    accounts,
    accountIndex: 0,
    uploading: false,
    resultVisible: false,
    result: { imported: 0, skipped: 0, errors: [] },
    resultDateText: "",
  },
  onLoad() {
    const ledger = app.globalData.currentLedger || {};
    if (!app.globalData.loggedIn) return wx.reLaunch({ url: "/pages/login/index" });
    if (ledger.readonly) {
      wx.showToast({ title: "访客不能导入账单", icon: "none" });
      setTimeout(() => wx.navigateBack(), 300);
      return;
    }
    this.setData({ ledgerId: ledger._id || "", ledgerName: ledger.name || "当前账本" });
  },
  onShow() {
    if (!this.data.uploading) {
      this.setData({
        resultVisible: false,
        result: { imported: 0, skipped: 0, errors: [], startDate: "" },
        resultDateText: "",
      });
    }
  },
  onAccountChange(event) {
    this.setData({ accountIndex: Number(event.detail.value) });
  },
  async downloadTemplate() {
    try {
      wx.showLoading({ title: "正在准备模板" });
      const data = await recordService.getImportTemplate();
      const download = await wx.downloadFile({ url: data.url });
      if (download.statusCode !== 200) throw new Error("模板下载失败");
      await wx.openDocument({ filePath: download.tempFilePath, fileType: "xlsx", showMenu: true });
    } catch (error) {
      wx.showToast({ title: error.message || "模板下载失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },
  async chooseAndImport() {
    if (this.data.uploading || !this.data.ledgerId) return;
    try {
      const selected = await wx.chooseMessageFile({
        count: 1,
        type: "file",
        extension: ["xls", "xlsx"],
      });
      const file = selected.tempFiles && selected.tempFiles[0];
      if (!file || !file.path) return;
      const confirmed = await new Promise((resolve) =>
        wx.showModal({
          title: "确认导入",
          content: `将导入 ${file.name || "所选文件"} 中的有效记录。重复导入会产生重复记录。`,
          success: (res) => resolve(res.confirm),
          fail: () => resolve(false),
        })
      );
      if (!confirmed) return;
      this.setData({ uploading: true });
      const uploaded = await wx.cloud.uploadFile({
        cloudPath: `imports/${app.globalData.openid}/${Date.now()}-${file.name || "bill.xls"}`,
        filePath: file.path,
      });
      const result = await recordService.importRecords({
        fileId: uploaded.fileID,
        ledgerId: this.data.ledgerId,
        defaultAccount: this.data.accounts[this.data.accountIndex],
      });
      app.globalData.recordsNeedRefresh = true;
      const range =
        result.startDate && result.endDate
          ? `已导入 ${result.startDate} 至 ${result.endDate} 的记录`
          : "导入已完成";
      this.setData({
        resultVisible: true,
        result: {
          imported: result.imported || 0,
          skipped: result.skipped || 0,
          errors: result.errors || [],
          startDate: result.startDate || "",
        },
        resultDateText: range,
      });
    } catch (error) {
      wx.showToast({ title: error.message || "导入失败", icon: "none" });
    } finally {
      this.setData({ uploading: false });
    }
  },
  continueImport() {
    this.setData({
      resultVisible: false,
      result: { imported: 0, skipped: 0, errors: [] },
      resultDateText: "",
    });
  },
  viewRecords() {
    const month = this.data.result.startDate ? this.data.result.startDate.slice(0, 7) : "";
    wx.redirectTo({
      url: `/pages/records/index${month ? `?month=${encodeURIComponent(month)}` : ""}`,
    });
  },
});
