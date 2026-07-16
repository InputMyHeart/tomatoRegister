# 数据模型与索引

当前处于开发阶段；生产备份与导出流程不在本阶段处理。

## CloudBase 索引

- records: ledgerId ASC, date DESC, _id DESC（账本记录游标分页）
- ledgerInvites: token ASC，唯一
- ledgers: inviteCode ASC，唯一
- ledgers: readonlyShareCode ASC，唯一
- users: openid ASC，唯一

## 字段约束

- 新建 ledger、record 写入 schemaVersion: 1。
- records.amount 必须为有限数字；date 使用 YYYY-MM-DD；type 仅 income 或 expense。
- 记录列表使用 date + id 游标：默认 30 条、最多 50 条，返回 hasMore 与 nextCursor。

## 一致性边界

云函数始终重新判定用户、账本和角色；删除账本、领取邀请、分类迁移等跨集合操作必须先在测试环境演练。
