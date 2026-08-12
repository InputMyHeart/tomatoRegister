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
