# 数据模型与索引

当前处于开发阶段；生产备份与导出流程不在本阶段处理。

## CloudBase 索引

- records: ledgerId ASC, date DESC, createdAt DESC, _id DESC (record-detail pagination and homepage recent records)
- records: ledgerId ASC, createdAt DESC (homepage recent-record query)（账本记录游标分页）
- ledgerInvites: token ASC，唯一
- ledgers: inviteCode ASC，唯一
- ledgers: readonlyShareCode ASC，唯一
- users: openid ASC，唯一

## 分类来源

- categories.source：`system` 表示账本初始化或系统自动补齐的分类；`custom` 表示用户手动新建的分类。
- “其他”一级分类及其系统默认子分类使用稳定标识保护，前端不展示编辑、删除入口，云函数也会拒绝对应写请求；“其他”的 sort 使用保留最大值，固定排在新增一级分类之后。

## 字段约束

- 新建 ledger、record 写入 schemaVersion: 1。
- records.amount 必须为有限数字；date 使用 YYYY-MM-DD；type 仅 income 或 expense。
- 记录列表使用 date + id 游标：默认 30 条、最多 50 条，返回 hasMore 与 nextCursor。

## 一致性边界

云函数始终重新判定用户、账本和角色；删除账本、领取邀请、分类迁移等跨集合操作必须先在测试环境演练。

## 意见反馈

- feedbacks: ownerOpenid ASC, createdAt DESC（用户反馈历史）
- feedbacks 字段：ownerOpenid、content（必填，最多 200 字）、type（feature/bug/improvement/other，可空）、images（最多 9 张 cloud:// 文件）、status（submitted/processing/resolved）和时间戳。云函数仅按当前 OpenID 查询，创建时状态固定为 submitted。
- ledgers.accounts stores 1-12 unique payment-account names; accountsConfigured distinguishes saved account lists from legacy defaults. Owner and member writes are revalidated in the cloud function; readonly visitors cannot update them.
