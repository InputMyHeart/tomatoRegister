# 工程规范

## 格式与静态检查

在项目根目录执行：

```bash
npm install
npm run format:check
npm run lint
```

自动修复 JavaScript、JSON 和 Markdown 的格式：

```bash
npm run format
npm run lint:fix
```

Prettier 使用 2 空格缩进、双引号、分号、LF 换行和 UTF-8 编码。提交前至少运行受影响部分的手工回归，并运行 `npm run check`。

## 命名与文件组织

- 页面目录和路由使用 `kebab-case`；发现历史路径不符合规范时，必须同步修改 `app.json` 和全部调用方，不保留旧路径。
- 变量、函数和数据字段使用 `camelCase`。
- 常量使用 `UPPER_SNAKE_CASE`。
- 自定义组件目录使用 `kebab-case`；组件标签统一使用项目约定的前缀时，采用 `tl-`。
- 云函数 action、前端调用参数和数据库字段变更必须同步修改全部调用方、数据结构说明与权限边界，不保留旧接口。

## 提交信息

使用以下前缀，后接简短、明确的中文或英文说明：

- `feat:` 新功能
- `fix:` 缺陷修复
- `refactor:` 不改变外部行为的重构
- `docs:` 文档修改
- `style:` 仅格式或样式调整
- `test:` 测试相关修改
- `chore:` 工具、构建或维护工作

每次提交只处理一个明确目标；涉及数据删除、迁移、权限或生产环境时，必须先准备备份和回退方案。
