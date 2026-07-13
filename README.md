# JSON Table Editor

纯前端、单 HTML 文件的 JSON 可视化编辑器，以电子表格形式编辑嵌套 JSON 数据。

## 快速开始

直接用浏览器打开 `index.html`，无需安装、编译或构建。

## 功能

- **表格编辑**：object 展开为单行多列表格，array 展开为多行表格，array-of-objects 自动合并 key 为多列表格
- **三种视图**：TABLE（表格）/ TEXT（原始字符串）/ RAW（JSON 文本），各自独立 DOM，通过按钮切换
- **无限嵌套**：单元格 `[+]` 展开子节点，`[-]` 收起，级联更新向上冒泡
- **纯 JSON 文本**：所有单元格存储 JSON 文本（显示 = 值），复制粘贴直接通传
- **数组操作**：行拖拽排序、自动追加空行
- **零依赖构建**：仅 CDN 加载 Handsontable 14.6

## 技术栈

| 项 | 说明 |
|----|------|
| 框架 | 无，原生 JavaScript |
| 表格 | Handsontable 14.6（jsDelivr CDN） |
| 字体 | monospace 13px |
| 代码 | 30 个函数，654 行，7 个代码段 |

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 主程序 |
| `SPEC.md` | 需求说明书 |
| `PLAN.md` | 实现提纲 |
