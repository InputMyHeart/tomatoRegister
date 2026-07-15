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

## 本地启动

1. 使用微信开发者工具导入项目根目录，导入类型选择“小程序”。
2. 确认项目配置使用 `miniprogram/` 作为小程序根目录、`cloudfunctions/` 作为云函数根目录。
3. 在微信开发者工具中开通或选择一个云开发环境。
4. 将环境 ID 填入 `miniprogram/app.js` 的 `globalData.env`；不要提交真实环境 ID。
5. 安装 `cloudfunctions/tomatoLedger` 的依赖，并以同名云函数部署。
6. 编译小程序；首次登录时，云函数会按需创建所需集合和用户记录。

## 云开发部署说明

- 业务云函数位于 `cloudfunctions/tomatoLedger`；前端依赖云函数名称 `tomatoLedger`，请保持一致。
- `resetDatabase` 仅可在测试环境验证；它会删除账本、分类、记录和邀请数据。
- 当前数据结构、权限边界和人工回归清单见 [docs/BASELINE.md](./docs/BASELINE.md)。