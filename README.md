# JSON Table Editor / JSON 表格编辑器

A pure frontend, single-file JSON visual editor that edits nested JSON data as spreadsheets.

纯前端、单 HTML 文件的 JSON 可视化编辑器，以电子表格形式编辑嵌套 JSON 数据。

## Quick Start / 快速开始

Open `index.html` in a browser. No install, no build, no dependencies.

直接用浏览器打开 `index.html`，无需安装、编译或构建。

## Features / 功能

- **Spreadsheet editing** — objects become single-row multi-column tables, arrays become multi-row tables, arrays-of-objects auto-merge keys into multi-column tables, matrices become multi-row multi-column freeform grids
- **Three views** — TABLE / TEXT / RAW, switchable per slot via buttons, independent DOM per view
- **Infinite nesting** — `[+]` expands a cell into a child slot, `[-]` collapses, changes cascade upward
- **Pure JSON text** — all cell values are JSON text strings (display = value), copy/paste passes through directly
- **JSON Schema** — optional `$schema` column defines type constraints, auto-derived type annotations and dropdowns
- **Array operations** — row drag-to-reorder, auto-spare rows/columns, auto column-width clamping [100, 500]
- **Fixed first column** — the leftmost column of every TABLE view stays locked while scrolling
- **Toast notifications** — top-center positioned, border-only style with three color modes: black (default), green (success), red (error)
- **Shortcuts** — Ctrl+O to open a JSON file, Ctrl+S to download the current data
- **Zero-dependency** — only CDN-loaded Handsontable 18.0

- **表格编辑** — obj 展开为单行多列表格，arr 展开为多行表格，arr-of-objs 自动合并 key 为多列表格，mat 展开为多行多列自由表格
- **三种视图** — TABLE / TEXT / RAW，每个 Slot 通过按钮切换，各自独立 DOM
- **无限嵌套** — 单元格 `[+]` 展开子节点，`[-]` 收起，级联更新向上冒泡
- **纯 JSON 文本** — 所有单元格存储 JSON 文本，复制粘贴直接通传
- **JSON Schema** — 可选 `$schema` 列定义类型约束，自动推导类型标注与 dropdown
- **数组操作** — 行拖拽排序、自动追加空行/空列、列宽自动裁剪 [100, 500]
- **第一列固定** — 所有 TABLE 视图首列滚动时保持冻结
- **通知提示** — 顶部居中显示，极简边框样式，三种颜色：黑色（默认）、绿色（成功）、红色（失败）
- **快捷键** — Ctrl+O 打开 JSON 文件，Ctrl+S 下载当前数据
- **零依赖** — 仅 CDN 加载 Handsontable 18.0

## Tech Stack / 技术栈

| Item / 项 | Detail / 说明 |
|-----------|---------------|
| Framework / 框架 | None, vanilla JavaScript |
| Table / 表格 | Handsontable 18.0 (jsDelivr CDN) |
| Font / 字体 | monospace 13px |
| Code / 代码 | ~23 functions, ~620 lines, 5 sections |

## Files / 文件

| File / 文件 | Description / 说明 |
|-------------|-------------------|
| `index.html` | Main program / 主程序 |
| `SPEC.md` | Specification / 需求说明书 |
| `PLAN.md` | Implementation outline / 实现提纲 |