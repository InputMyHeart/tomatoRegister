// components/navBar/index.js
const app = getApp();

Component({
	options: {
    addGlobalClass: true
  },
	/**
	 * 组件的属性列表
	 */
	properties: {
		title: {
			type: String,
			value: '没有标题'
		},
		isBack: {
			type: Boolean,
			value: true,
		}
	},

	/**
	 * 组件的初始数据
	 */
	data: {
		navBarHeight: app.globalData.navBarHeight,
		statusBarHeight: app.globalData.statusBarHeight,
		capsuleWidth: app.globalData.capsuleWidth,
		isNavBar: app.globalData.isNavBar
	},
	
	lifetimes: {
    attached: function () {
			
    }
  },

	/**
	 * 组件的方法列表
	 */
	methods: {
		back(){
			wx.navigateBack();
		},
	}
})
