# Contributing to Mermaid Lens

感谢你参与 Mermaid Lens 的开发。提交改动前，请确保测试、类型检查和生产构建均能通过；涉及真实 DOM 或交互的改动还需要在 Obsidian 中验收。

## 开发环境

- Node.js 22
- npm
- Obsidian 1.12.0 或更高版本

克隆仓库并安装依赖：

```bash
git clone https://github.com/aitsuki/obsidian-mermaid-lens.git
cd obsidian-mermaid-lens
npm ci
```

## 常用命令

```bash
npm test
npm run test:coverage
npm run lint
npm run typecheck:test
npm run build
```

- `npm test`：运行单元测试和 DOM 行为测试。
- `npm run test:coverage`：运行测试并检查覆盖率门槛。
- `npm run lint`：使用 Obsidian 官方 ESLint 规则检查源码。
- `npm run typecheck:test`：检查源码和测试代码的 TypeScript 类型。
- `npm run build`：执行源码与测试类型检查，并在 `dist/` 中生成生产构建。

为兼容当前公开稳定版 Obsidian 1.12，设置页继续使用 `PluginSettingTab.display()`。因此 lint 会报告两条与 Obsidian 1.13 声明式设置 API 有关的预期警告；它们不阻塞构建或插件市场审核。不要仅为消除这两条警告而提高 `minAppVersion`。

生产构建包含：

```text
dist/
├── main.js
├── manifest.json
└── styles.css
```

## 在真实 Obsidian 中验收

项目提供本地测试 Vault 和多维度验收笔记：

```bash
npm run deploy
```

该命令会：

1. 构建插件。
2. 创建被 Git 忽略的 `ObsidianTestVault/`。
3. 将插件部署到 `ObsidianTestVault/.obsidian/plugins/mermaid-lens/`。
4. 将验收笔记复制到 `ObsidianTestVault/Mermaid Lens Tests/`。
5. 注册测试 Vault，并通过 Obsidian URI 打开 Vault 和验收清单。

验收笔记覆盖简单、中等和大型图表，以及流程图、时序图、状态图、类图、ER 图、图中链接、重复 SVG ID 和超宽图表。

部署到其他测试 Vault：

```bash
npm run deploy -- --vault "C:\path\to\vault"
```

不复制验收笔记：

```bash
npm run deploy -- --vault "C:\path\to\vault" --no-notes
```

只部署，不打开 Obsidian：

```bash
npm run deploy -- --no-open
```

修改代码后需要重新部署，并在 Obsidian 中重新加载插件或禁用后再次启用。可按 `Ctrl+Shift+I` 打开开发者工具检查 Console。

## 项目结构

- `src/main.ts`：插件生命周期、设置保存、重绘与扫描。
- `src/config-manager.ts`：应用和回滚 Obsidian 的共享 Mermaid 配置。
- `src/diagram-registry.ts`：监听异步渲染的 SVG 并挂载查看器入口。
- `src/viewer.ts`、`src/viewer-utils.ts`：查看器交互及 SVG/视图计算。
- `src/settings.ts`：默认配置与设置界面。
- `tests/mocks/obsidian.ts`：Vitest 使用的 Obsidian mock。

## 实现说明

- 插件在 Obsidian 加载 Mermaid 时合并全局配置，并在卸载时恢复原始配置。
- 图表通过 DOM 变化监听自动登记，不能仅依赖固定延迟扫描。
- 查看器会等待弹窗完成布局，并在窗口尺寸变化时重新计算适配状态。
- 查看器中的 SVG 克隆会重写内部 ID，避免 marker、filter 和 gradient 与笔记中的原图冲突。
- 应用配置时会保留编辑器的光标和滚动位置，并仅重绘包含 Mermaid 的 Markdown 视图。

## 发布

```bash
# 发布 release，自动更新版本号、运行 lint、测试与构建，提交版本变更并创建同名 annotated tag
npm run release -- <tag>

# 推送提交和tag
git push --atomic origin main refs/tags/<tag>
```

GitHub Actions 会在 tag 推送后重新验证版本，运行 lint、测试与构建，为 `main.js` 和 `styles.css` 生成 GitHub artifact attestations，生成发行说明，并发布带有 `main.js`、`manifest.json` 和 `styles.css` 的 GitHub Release。

## 提交前检查

```bash
npm run lint
npm run test:coverage
npm run build
```

涉及图表尺寸、查看器交互、移动端手势或 Obsidian 编辑状态的改动，还应通过验收 Vault 手动检查。
