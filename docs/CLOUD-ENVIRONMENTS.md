# 云开发环境切换

配置文件：miniprogram/config/cloud-env.js。

- 开发版（develop）和体验版（trial）自动使用 test。
- 正式版（release）自动使用 production。
- production 的 ID 当前留空；创建生产环境后只填写该文件中的 production.id。
- 如需本地临时指定环境，填写 LOCAL_OVERRIDE 为 test 或 production；提交前恢复为空。
- 环境改变时，小程序会清空本地登录缓存，避免测试数据与生产数据混用。
- 上传生产版本前必须确认 production.id 已填写并部署同名 tomatoLedger 云函数。
