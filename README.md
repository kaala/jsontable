# JSON Table Editor / JSON 表格编辑器

A pure frontend, single-file JSON visual editor that edits nested JSON data as spreadsheets.
纯前端、单 HTML 文件的 JSON 可视化编辑器，以电子表格形式编辑嵌套 JSON 数据。

## Quick Start / 快速开始

Open `index.html` in a browser. No install, no build, no dependencies.
直接用浏览器打开 `index.html`，无需安装、编译或构建。

## Features / 功能

- **Spreadsheet editing / 表格编辑**: objects become single-row multi-column tables, arrays become multi-row tables, arrays-of-objects auto-merge keys into multi-column tables, matrices become multi-row multi-column freeform grids
- **Three views / 三种视图**: TABLE / TEXT / RAW, switchable per slot via buttons, independent DOM per view
- **Infinite nesting / 无限嵌套**: `[+]` expands a cell into a child slot, `[-]` collapses, changes cascade upward
- **Pure JSON text / 纯 JSON 文本**: all cell values are JSON text strings (display = value), copy/paste passes through directly
- **JSON Schema**: optional `$schema` column defines type constraints, auto-derived type annotations and dropdowns
- **Array operations / 数组操作**: row drag-to-reorder, auto-spare rows/columns
- **Zero-dependency / 零依赖**: only CDN-loaded Handsontable 14.6

## Tech Stack / 技术栈

| Item / 项 | Detail / 说明 |
|-----------|---------------|
| Framework / 框架 | None, vanilla JavaScript |
| Table / 表格 | Handsontable 14.6 (jsDelivr CDN) |
| Font / 字体 | monospace 13px |
| Code / 代码 | 23 functions, 535 lines, 5 sections |

## Files / 文件

| File / 文件 | Description / 说明 |
|-------------|-------------------|
| `index.html` | Main program / 主程序 |
| `SPEC.md` | Specification / 需求说明书 |
| `PLAN.md` | Implementation outline / 实现提纲 |
