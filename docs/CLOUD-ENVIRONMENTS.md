# 云开发环境切换

环境配置的唯一入口是 `miniprogram/config/cloud-env.js`。

- 开发版（`develop`）和体验版（`trial`）自动使用 `test`。
- 正式版（`release`）自动使用 `production`。
- `production.id` 当前留空；创建生产环境后只填写该配置项。
- 本地临时切换可设置 `LOCAL_OVERRIDE` 为 `test` 或 `production`，提交前必须恢复为空。
- 环境改变时，小程序会清除本地登录、账本和分类缓存，避免测试与生产数据混用；记录列表不持久化到本地。
- 正式版缺少环境 ID 时必须明确失败，不能回退或误连测试环境。

上传正式版本前：

1. 确认 `production.id` 已配置。
2. 在生产环境部署同名 `tomatoLedger` 云函数。
3. 核对生产环境集合、索引和安全规则。
4. 确认测试数据、用户数据和密钥未写入仓库。
5. 运行 `npm run verify` 并完成 `docs/REGRESSION.md`。
