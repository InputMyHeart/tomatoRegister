# Step 0：改造基线

本文记录当前代码可见的运行边界、数据模型和手工回归范围。它不是功能冻结：后续变更如改变边界或验收预期，应同步更新本文。

## 基线范围

- 小程序根目录：`miniprogram/`
- 云函数根目录：`cloudfunctions/`
- 业务云函数：`tomatoLedger`
- 当前 Git 基准提交：`5759f7f feat: polish profile and ledger settings pages`
- 云环境：由维护者在本地 `miniprogram/app.js` 的 `globalData.env` 配置；仓库不保存环境 ID。

建立本文时，工作区已经存在未提交的功能和资源调整。因此它只是文档基线：没有创建 Git 提交，也不代表生产数据快照。

## 启动与部署检查

1. 使用微信开发者工具导入项目根目录。
2. 选择非生产 CloudBase 云开发环境，并在 `globalData.env` 中配置环境 ID。
3. 安装依赖后，将 `cloudfunctions/tomatoLedger` 以同名云函数部署。
4. 编译并进入登录页。云函数在首次使用时会尝试创建 `users`、`ledgers`、`categories`、`records`、`ledgerInvites` 五个集合。
5. 不得在生产环境调用 `resetDatabase`，也不得将测试数据或用户数据写入仓库。

## 数据集合与访问边界

| 集合 | 用途 | 代码可见的关键字段 | 访问边界 |
| --- | --- | --- | --- |
| `users` | 用户与当前账本 | `openid`、`userNo`、`nickName`、`avatarUrl`、`gender`、`currentLedgerId`、时间戳 | 云函数按微信 OpenID 查询和更新 |
| `ledgers` | 账本、成员、预算、邀请码 | `ownerOpenid`、成员/访客列表、`inviteCode`、`readonlyShareCode`、预算字段 | owner 可管理；member 可写记录；visitor 只读 |
| `records` | 收支记录 | `ledgerId`、`ownerOpenid`、`type`、`amount`、分类字段、`date`、`account`、`tags`、时间戳 | owner/member 可写；非 owner 的 member 只能修改自己的记录 |
| `categories` | 分类树 | `ledgerId`、`type`、`level`、`parentId`、`name`、`icon`、`sort`、默认标记 | owner 可编辑和删除；owner/member 可新增 |
| `ledgerInvites` | 单次领取的邀请令牌 | `token`、`ledgerId`、`mode`、`ownerOpenid`、`claimedOpenid`、时间戳 | 仅 owner 可创建；领取后令牌绑定到一个 OpenID |

云函数实现是字段和权限的唯一事实来源。调整集合名称、字段契约或角色判断前，应先更新本文。

## 核心人工回归清单

- [ ] 登录：首次登录创建用户；重新进入后恢复用户和当前账本。
- [ ] 账本：创建个人和共享账本；切换账本；owner 删除账本后当前账本状态正确。
- [ ] 记账：新增收入和支出；查看、编辑、删除；确认列表和首页统计同步更新。
- [ ] 预算：owner 可修改预算和记账周期起始日；非 owner 不可修改。
- [ ] 邀请：owner 创建邀请；member 加入后可记账；visitor 加入后仅可查看。
- [ ] 分类：默认分类正常加载；新增、编辑、删除分类；删除分类后相关记录迁移到“其他”。
- [ ] 个人资料：修改昵称、头像和性别；重新进入后数据仍可读取。

## 已知边界与风险

- `listRecords` 当前最多返回 100 条记录；数据量增长后需要实现分页。
- 数据库索引、CloudBase 安全规则和生产备份策略未在本仓库版本化；发布前需要在 CloudBase 控制台单独确认。
- `resetDatabase` 是破坏性测试工具，不能向生产用户暴露。
- 邀请、删除账本和分类迁移会执行多次写操作；调整这些功能时需验证一致性与失败恢复表现。

## 每次改动的最低要求

1. 确认受影响的页面路由、云函数 action、字段契约和角色边界。
2. 改动后执行相关人工回归项；行为变化时同步更新本文。
3. 涉及删除、迁移、权限或生产操作时，先在测试环境演练，并记录备份与回退方案。