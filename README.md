# 番茄记账

家庭式个人记账微信小程序，基于微信小程序云开发构建。

当前重点：

- 番茄色统一 UI
- 微信云开发登录
- 用户资料编辑
- 多账本与家庭共享蓝图
- 首页、明细、我的页面逐步打磨

详细规划见 [BLUEPRINT.md](./BLUEPRINT.md)。

## 重要约束

`miniprogram/app.js` 中的 `globalData.env` 由项目维护者手动填写，后续开发不要覆盖或清空。

云函数业务代码放在 `cloudfunctions/tomatoLedger`，不要改动 `cloudfunctions/quickstartFunctions`。