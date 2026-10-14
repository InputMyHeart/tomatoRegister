# 数据模型与索引

云函数是字段契约和权限判断的唯一事实来源。修改集合、字段、索引或角色边界时，必须同步更新云函数、全部调用方、相关测试和本文。

## 业务集合

| 集合               | 用途                             | 关键约束                                 |
| ------------------ | -------------------------------- | ---------------------------------------- |
| `users`            | 用户资料与当前账本               | `openid` 唯一                            |
| `ledgers`          | 账本、成员、访客、预算、账户配置 | 邀请码字段唯一；账户名称去重且为 1–12 个 |
| `records`          | 收支记录                         | 必须包含有效金额、日期、类型及账本归属   |
| `categories`       | 账本分类树                       | 按账本、类型、层级和父分类组织           |
| `ledgerInvites`    | 单次领取邀请令牌                 | `token` 唯一且至多绑定一个 OpenID        |
| `ledgerOperations` | 可恢复的账本批处理进度           | 用于删除等分阶段、可重试操作             |
| `feedbacks`        | 用户反馈及处理状态               | 仅当前 OpenID 可查询自己的反馈           |

云函数会按需创建业务集合；集合创建不等于索引和生产安全规则已经配置完成。

## 字段约束

- 新建 `ledger`、`record` 写入 `schemaVersion: 1`。
- `records.amount` 必须为有限数值。
- `records.date` 使用 `YYYY-MM-DD`。
- `records.type` 仅可为 `income` 或 `expense`。
- 记录分页使用 `{ date, id }` 游标，默认 30 条、最大 50 条，并返回 `hasMore` 与 `nextCursor`。
- `categories.source`：`system` 表示系统分类，`custom` 表示用户创建的分类。
- “其他”一级分类及系统默认子分类使用稳定标识保护；前端不提供编辑、删除入口，云函数也拒绝对应写请求。
- `ledgers.accounts` 保存 1–12 个不重复的支付账户名称；`accountsConfigured` 区分已保存配置与旧数据默认值。
- `ledgers.name` 为 1–8 个字符，`ledgers.remark` 最多 80 个字符；只有 Owner 可通过 `ledger/update` 编辑，服务端会重新读取账本并校验角色。
- `ledgers.syncRevision` 是服务端维护的单调递增同步版本。记录、分类、成员、邀请和账本设置等影响共享视图的写操作完成后必须递增；客户端不得提交或覆盖该字段。

## 客户端同步

- `ledger/sync` 接收客户端缓存的 `{ ledgerId: syncRevision }` 映射，只读取当前用户有权访问账本的 ID 与版本进行比较。
- 版本未变化时不返回账本完整数据；版本变化、新增或移除时，同一响应返回最新账本列表及变化账本 ID。
- 小程序有缓存时立即展示；前台按 2 分钟间隔后台校验。只有检测到变化时，当前可见的首页、明细或分析模块才重新请求业务数据。
- “我的 → 同步数据”提供强制校验入口。所有业务数据仍通过 `tomatoLedger` 获取，缓存和版本号都不能替代云函数权限判断。
- `ledger/analysis/get` 按月、年或全部时间一次返回概览、上期对比、补齐零值时间桶的趋势、收支分类、支付账户、共享成员录入支出及账本级预算执行。当前月/年使用上期同期对比，历史周期使用完整上期；账本预算仅代表当前配置，因此只在当前月展示。成员维度依据记录创建者统计，不代表实际付款人。
- 年度模式的 `recentYearTrend` 固定补齐包括当前年在内的最近 5 个自然年。
- `feedbacks.content` 必填且最多 200 字；`type` 可为 `feature`、`bug`、`improvement`、`other` 或空；`images` 最多 9 个云文件；`status` 为 `submitted`、`processing` 或 `resolved`。

## CloudBase 索引

以下索引需要在目标 CloudBase 环境中配置并在发布前核对：

- `records`：`ledgerId ASC, date DESC, createdAt DESC, _id DESC`，用于记录游标分页。
- `records`：`ledgerId ASC, createdAt DESC`，用于最近记录查询。
- `ledgerInvites`：`token ASC`，唯一。
- `ledgers`：`inviteCode ASC`，唯一。
- `ledgers`：`readonlyShareCode ASC`，唯一。
- `users`：`openid ASC`，唯一。
- `feedbacks`：`ownerOpenid ASC, createdAt DESC`，用于反馈历史。

索引和 CloudBase 安全规则不由当前仓库自动部署；测试与生产环境需分别确认。

## 一致性边界

- 云函数始终重新读取用户和账本并判定角色，不信任客户端传入的身份或权限字段。
- Owner 和成员的记录、账户等写入权限在云函数中重新校验；只读访客不能写入。
- 邀请领取、分类迁移和账本删除的具体一致性要求见 [WRITE-SAFETY.md](./WRITE-SAFETY.md)。
- 生产备份、迁移与恢复流程尚未落地，记录在 [`plan/PENDING.md`](../plan/PENDING.md)。
