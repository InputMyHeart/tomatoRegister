// 云函数模板
// 部署：在 cloud-functions/login 文件夹右击选择 “上传并部署”

const cloud = require('wx-server-sdk');

// 初始化 cloud
cloud.init({
  // API 调用都保持和云函数当前所在环境一致
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();


/**
 * 这个示例将经自动鉴权过的小程序用户 openid 返回给小程序端
 * 
 * event 参数包含小程序端调用传入的 data
 * 
 */
exports.main = async (event, context) => {

  // 获取 WX Context (微信调用上下文)，包括 OPENID、APPID、及 UNIONID（需满足 UNIONID 获取条件）等信息
  const wxContext = cloud.getWXContext()

  let userInfo = {
    name: event.nickName,
    avatar: event.avatarUrl,
    gender: event.gender,
    openid: wxContext.OPENID
  };
  let whereRes = await db.collection("userList").where({openid: wxContext.OPENID}).get();
  
  if(whereRes.data.length == 0){
    await db.collection('userList').add({
      data: userInfo
    })
    return {
      status: 200,
      data: userInfo
    }
  }else{
    return {
      status: 200,
      data: whereRes.data[0]
    }
  }


  // return {
  //   res,
  //   openid: wxContext.OPENID,
  //   appid: wxContext.APPID,
  //   unionid: wxContext.UNIONID,
  //   env: wxContext.ENV,
  // }
}

