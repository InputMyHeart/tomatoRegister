// miniprogram/pages/home/index.js
const app = getApp();

Page({

	/**
	 * 页面的初始数据
	 */
	data: {
		isNavBar: app.globalData.isNavBar,
		navBarHeight: app.globalData.navBarHeight,
	},

	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad: function (options) {

	},



	/**
	 * 用户点击右上角分享
	 */
	onShareAppMessage: function () {

	}
})