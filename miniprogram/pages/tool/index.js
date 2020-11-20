// miniprogram/pages/tool/index.js
const app = getApp();

Page({

	/**
	 * 页面的初始数据
	 */
	data: {
		navBarHeight: app.globalData.navBarHeight,
		isNavBar: app.globalData.isNavBar,
		mainData: [
			{
				title: '吃什么',
				en: 'Eat',
				router: '/pages/tool/eat/index',
				icon: 'icon-text',
				type: 'navigate'
			},
			{
				title: '天气',
				en: 'Weather',
				router: '/pages/tool/weather/index',
				icon: 'icon-clothes',
				type: 'navigate'
			},
		],
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