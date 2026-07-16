# 番茄记账

一个基于微信小程序云开发的家庭记账应用。它支持个人账本和共享账本：成员可以共同记账，访客可以只读查看；数据、权限和核心业务逻辑统一由云函数处理。

项目目前处于开发与测试阶段。开发版、体验版共用测试云环境；生产云环境尚未创建，配置位已预留。

## 功能概览

- 微信登录与个人资料维护
- 个人账本、共享账本、账本切换与预算设置
- 收入/支出记录的新建、编辑、删除与分类、账户、标签管理
- 首页月度汇总、预算进度、最近记录
- 明细按账本周期浏览，支持筛选、月份切换和触底加载下一页
- 多级分类维护；删除分类时迁移关联记录
- 邀请成员或只读访客加入账本
- 账本删除的可恢复分阶段处理

## 技术结构

```text
miniprogram/                         小程序前端
  pages/                              页面与页面级状态
  components/                         tl-* 通用业务组件
  services/                           云函数路由调用封装
  utils/                              金额、日期、映射等纯工具函数
  config/cloud-env.js                测试/生产环境选择
cloudfunctions/tomatoLedger/          业务云函数
  index.js                            路由、统一响应、结构化日志
  actions/                            认证、账本、记录、分类、邀请入口
  shared/ validators/ policies/       响应、校验、权限边界
  legacy.handlers.js                 当前业务实现与数据访问逻辑
scripts/                              本地质量检查脚本
tests/                                Node 内置测试
docs/                                 数据模型、环境、回归与写安全说明
```

## 云函数接口

前端只通过 `miniprogram/services/` 调用云函数 `tomatoLedger`。

请求使用新协议：

```js
wx.cloud.callFunction({
  name: "tomatoLedger",
  data: {
    route: "record/list",
    payload: { ledgerId, start, end, cursor },
  },
});
```

云函数返回：

```js
{ ok: true, data: {} }
// 或
{ ok: false, error: { code, message } }
```

不要重新引入旧的 `action + data` 调用协议。

## 本地启动

1. 安装根目录工具依赖：`npm install`
2. 使用微信开发者工具导入仓库根目录。
3. 确认项目根目录配置：小程序为 `miniprogram/`，云函数为 `cloudfunctions/`。
4. 在微信开发者工具中选择测试云环境。
5. 安装并部署 `cloudfunctions/tomatoLedger`：右键云函数，选择“上传并部署：云端安装依赖”。
6. 编译小程序并登录。

云函数会按需创建业务集合。`resetDatabase` 是破坏性测试工具，不能在生产环境调用。

## 测试与生产环境

环境配置在 [miniprogram/config/cloud-env.js](./miniprogram/config/cloud-env.js)：

- `test`：开发版与体验版自动使用。
- `production`：正式版自动使用；当前 `id` 留空。

创建生产云环境后，只填写 `production.id`，并部署同名 `tomatoLedger` 云函数。若正式版未配置生产 ID，应用会明确报错，不会误连测试库。

环境切换时会清除本地登录缓存，避免测试与生产数据混用。详见 [云环境说明](./docs/CLOUD-ENVIRONMENTS.md)。

## 数据与一致性

核心集合：`users`、`ledgers`、`records`、`categories`、`ledgerInvites`、`ledgerOperations`。

- 记录列表使用 `{ date, id }` 游标，默认 30 条、最大 50 条。
- 新建账本和记录写入 `schemaVersion: 1`。
- 云函数始终重新校验用户、账本归属和角色，不信任客户端权限参数。
- 邀请令牌领取使用事务，令牌绑定和成员写入保持一致。
- 账本删除使用 `records → categories → ledger → complete` 阶段记录；中断后重复请求可续跑。

索引和字段约束见 [数据库文档](./docs/DATABASE.md)，跨集合写操作策略见 [写安全说明](./docs/WRITE-SAFETY.md)。

## 质量检查

日常改动后运行：

```powershell
npm run verify
```

它会依次执行：

- JavaScript、JSON、WXSS、WXML 格式检查
- ESLint
- 金额、映射、云路由、环境选择等核心测试
- 所有云函数模块语法检查

相关命令：

```powershell
npm run format       # 格式化全部文件（包括 WXML）
npm run test         # 仅运行测试
npm run cloud:check  # 仅检查云函数语法
```

WXML 已纳入格式检查；不要再将模板压缩成单行。

## 日志与排错

- 前端错误：微信开发者工具“调试器 → Console”。
- 云函数错误：CloudBase 控制台 → 云函数 → `tomatoLedger` → 日志。

云函数日志以 JSON 输出，包含 `requestId`、`route`、`ledgerId`、耗时、状态和错误码，不记录完整请求 payload。部署新云函数后日志格式才会生效。

## 发布前手工回归

除 `npm run verify` 外，在微信开发者工具中至少检查：登录、创建/切换账本、记录 CRUD、预算、明细分页、邀请领取、分类迁移和账本删除。完整清单见 [REGRESSION.md](./docs/REGRESSION.md)。

## 当前待决业务规则

以下规则尚未定义，因此没有擅自实现：

- 成员退出后历史记录的归属与可见性。
- Owner 是否可退出及其账本归属处理。
- 邀请过期、撤销和重复领取的产品规则。

规则确定后，应先补充数据约束、云函数实现和对应测试，再发布。

## 相关文档

- [项目改造蓝图](./plan/BLUEPRINT.md)
- [数据库模型与索引](./docs/DATABASE.md)
- [云环境切换](./docs/CLOUD-ENVIRONMENTS.md)
- [写操作一致性](./docs/WRITE-SAFETY.md)
- [发布前回归清单](./docs/REGRESSION.md)
