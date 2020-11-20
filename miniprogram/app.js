//app.js
App({
  globalData: {
    userInfo: null,
    isIphoneX: false,
    statusBarHeight: 0, // 自定义状态栏高度
    navBarHeight: 0, // 自定义导航栏整体高度
    capsuleWidth: 0, // 胶囊宽度
    isNavBar: false,
  },
  onLaunch: function () {
    // 全局设置缓存信息
    let userInfo =  wx.getStorageSync('userInfo');
    if(!userInfo){
      wx.setStorageSync('userInfo', null);
    }


    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        // env: 'my-env-id',
        traceUser: true,
      })
    }

    var that = this;
    //检测手机类型/适配刘海屏
    let capsule = wx.getMenuButtonBoundingClientRect(); // 胶囊信息

    wx.getSystemInfo({
      success: function (res) {
        if (res.model.search("iPhone X") != -1 || res.model.search("iPhone 11") != -1) {
          that.globalData.isIphoneX = true;
        }
        let statusBarHeight = res.statusBarHeight; // 状态栏高度
        let navBarHeight = capsule.top + capsule.bottom - res.statusBarHeight + 4; // 自定义导航高度
        let capsuleWidth = capsule.width + 10; // 胶囊宽度 + 间距
        // console.log('手机信息',res)
        // console.log('胶囊信息',capsule)
        that.globalData.statusBarHeight = statusBarHeight;
        that.globalData.navBarHeight = navBarHeight;
        that.globalData.capsuleWidth = capsuleWidth;
        that.globalData.isNavBar = true;  // 自定义导航栏加载就绪
      }
    });
  },

  showToast(text,icon){
    wx.showToast({
      title: text,
      icon: icon
    })
  },
})
