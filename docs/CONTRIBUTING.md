# 工程与协作规范

## 开发前

- 阅读根目录 `AGENTS.md`，它包含必须遵守的接口、权限、数据与发布约束。
- 当前未完成事项只在 `plan/PENDING.md` 维护。
- 修改字段契约、权限边界或验收预期时，同步更新对应 `docs/` 文档和测试。

## 格式与质量检查

在项目根目录安装依赖并运行完整校验：

```powershell
npm install
npm run verify
```

常用的分项命令：

```powershell
npm run format:check
npm run lint
npm run test
npm run cloud:check
npm run ui:check
npm run visual:check
```

需要自动格式化或修复 Lint 时：

```powershell
npm run format
npm run lint:fix
```

项目使用 UTF-8、LF、2 空格缩进、双引号和分号；WXML 也纳入格式检查，不得压缩成单行。

UI 修改遵守 [`UI-GUIDELINES.md`](./UI-GUIDELINES.md)，优先使用 `app.wxss` 语义 Token 和公共组件。视觉变更先运行 `npm run ui:check`；关键页面需运行 `npm run visual:check`。仅在差异已确认符合设计意图后运行 `npm run visual:update` 更新截图基线。

## 命名与文件组织

- 页面目录、路由和自定义组件目录使用 `kebab-case`。
- 变量、函数和数据字段使用 `camelCase`。
- 常量使用 `UPPER_SNAKE_CASE`。
- 自定义业务组件使用 `tl-` 前缀。
- 调整页面路径时同步更新 `miniprogram/app.json` 与全部调用方，不保留失效旧路径。
- 云函数路由、前端参数和数据库字段变化时，同步修改全部调用方、数据文档、权限边界与测试，不保留旧接口。

## 文档职责

- `README.md`：当前项目入口、已实现能力、启动与发布说明。
- `docs/`：长期有效的数据、环境、安全、回归和协作规则。
- `plan/PENDING.md`：唯一待办入口，只记录未完成、待决策和暂缓事项。
- `AGENTS.md`：自动化协作者必须执行的强制约束。
- 已完成过程和历史方案由 Git 历史承担，不新增流水账式 Markdown。

文档与代码冲突时，先判断代码是否违反安全或产品约束；不能未经核验直接让文档迁就代码。

## 提交与验收

提交信息使用 `feat:`、`fix:`、`refactor:`、`docs:`、`style:`、`test:` 或 `chore:` 前缀。每次提交只处理一个明确目标。

提交前：

- 运行受影响检查；代码修改通常运行 `npm run verify`。
- 按 `docs/REGRESSION.md` 完成相关手工回归。
- UI 修改通过 `npm run ui:check`；关键页面视觉变更完成截图回归。
- 行为、数据边界或验收预期变化时同步更新文档与测试。
- 涉及删除、迁移、权限或生产数据时，先准备测试环境演练、备份和回滚方案。
