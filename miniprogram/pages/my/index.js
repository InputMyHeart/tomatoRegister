// miniprogram/pages/my/index.js
const app = getApp();
Page({

	/**
	 * 页面的初始数据
	 */
	data: {
		userInfo: null,
		navBarHeight: app.globalData.navBarHeight,
		isRotate: false, // 是否触发头像彩蛋
		isNavBar: app.globalData.isNavBar
	},

	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad: function (options) {
		// 判断当前用户信息缓存
		let info = wx.getStorageSync('userInfo');
		this.setData({
			userInfo: info
		})

	},

	bindGetUserInfo: function(e){
		if (e.detail.userInfo){
			this.login(e.detail.userInfo);
		}else{
			wx.showToast({
				title: '您拒绝了授权,当前无法完成登录',
				icon: 'none'
			})
		}
	},

	// 登录
	login(userInfo){
		wx.showLoading({
			title: '登录中...',
		})
		let that = this;
		wx.cloud.callFunction({
      name: 'login',
      data: userInfo,
      success: res => {
				wx.setStorageSync('userInfo', res.result.data);
				app.globalData.userInfo = res.result.data;
				that.setData({
					userInfo: app.globalData.userInfo
				})
				wx.hideLoading();
      },
      fail: err => {
        wx.showToast({
					title: '好像出了点问题,请稍后再试',
					icon: 'none'
				})
      }
    })
	},

	// 退出登录
	signOut(){
		wx.setStorageSync('userInfo', null)
		wx.showToast({
			title: '退出登录成功',
		})
		this.onLoad();
	},

	// 头像彩蛋
	rotateAvatar(){
		if(this.data.isRotate) return;
		this.setData({
			isRotate: true,
			style: 'transform: rotate(1080deg);transition: all 3s;'
		})
		setTimeout(() => {
			this.setData({
				isRotate: false
			})
		},3000)
	},

	showToast(){
		let text = '别急，正在开发';
		let icon = 'none'
		app.showToast(text,icon);
	},

})