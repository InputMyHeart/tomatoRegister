// miniprogram/pages/my/suggestion/index.js
const app = getApp();

Page({

	/**
	 * 页面的初始数据
	 */
	data: {
		navBarHeight: app.globalData.navBarHeight,
		current: 0,
		imgData: [{},{},{},{},{},{},{},{},{},],
	},

	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad: function (options) {

	},
	
	changeTab(e){
		let type = e.currentTarget.dataset.type;
		let cur = '';
		if(type == 'tab'){
			cur = e.currentTarget.dataset.cur;
		}else{
			cur = e.detail.current;
		}
		this.setData({
			current: cur
		})
	},

	

	/**
	 * 用户点击右上角分享
	 */
	onShareAppMessage: function () {

	}
})