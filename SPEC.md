# JSON Table Editor — 需求说明书

## 1. 项目概述

**目标**：纯前端、单 HTML 文件的 JSON 可视化编辑器，以电子表格形式编辑嵌套 JSON 数据。

**交付形态**：单个 `.html` 文件，CDN 加载 Handsontable 18.0，零编译零构建，原生 JavaScript。

---

## 2. 技术约束

| 约束 | 说明 |
|------|------|
| **框架** | 无框架，纯原生 JavaScript |
| **构建** | 无编译、无打包 |
| **表格库** | Handsontable 18.0（CDN，非商业许可） |
| **字体** | `monospace`（13px） |
| **主题** | Light 主题，极简 CSS |
| **文件** | 单 HTML 文件自包含 |

---

## 3. 核心概念

### 3.1 Slot（槽位）

整个编辑器基于 Slot 概念构建。每个 Slot 代表一个 JSON 节点的编辑容器，形成与 JSON 结构对应的嵌套树。

- **根 Slot**：页面加载即创建，路径 `$`，包含 `$schema` 和 `data` 两列
- **子 Slot**：通过单元格 `[+]` 按钮展开创建，支持无限嵌套
- 所有 Slots 按在父表格中的行列位置排序插入 DOM

### 3.2 三种视图

每个 Slot 提供三种视图，通过按钮切换：

| 视图 | 按钮 | 可见条件 | 说明 |
|------|------|---------|------|
| **TABLE** | TABLE | obj / arr / mat | 子表格，结构化编辑 |
| **TEXT** | TEXT | 仅 str | 原始字符串 textarea，无引号无转义 |
| **RAW** | RAW | 所有类型 | JSON 格式 textarea |

### 3.3 数据存储

- 所有 Handsontable 单元格值均为 JSON 文本字符串（display = value）
- Slot 内部维护原始解析后的值（`_raw`）
- 根 Slot 的原始值映射到全局 `S.root`

---

## 4. 关键行为

### 4.1 表格形态

| JSON 类型 | 表格形态 | 配置 |
|-----------|---------|------|
| **obj** | 单行，属性名为列头（带类型标注） | `colHeaders: keys` |
| **mat**（元素均为 arr 的 arr） | 多行多列表格 | 行列表头，`minSpareRows: 2`，`minSpareCols: 3`，行拖拽 |
| **arr（元素均为 obj）** | 多列，合并所有对象的 key 为列头 | 行表头，`minSpareRows: 2`，行拖拽 |
| **arr（其他）** | 单列，行表头 | `minSpareRows: 2`，行拖拽 |
| **原始类型** | 单单元格 | 无行/列表头 |

### 4.2 单元格操作

- **`[+]` 按钮**：解析单元格 JSON 字符串为原始值，创建子 Slot；obj/arr/mat 默认 TABLE 视图，str 默认 TEXT 视图，其他默认 RAW 视图
- **`[-]` 按钮**：销毁子 Slot 及其所有后代，父单元格恢复折叠状态
- **内联编辑**：双击进入 Handsontable 编辑器；str 类型单元格编辑时自动去掉 JSON 双引号，提交时自动加回
- **超长文本**：由 CSS `text-overflow: ellipsis` 截断显示，hover `td.title` 显示 `formatJSON(value)` 格式化内容
- **列宽自动限制**：首次渲染后读取各列实际宽度，自动裁剪到 `[100, 500]` 区间；已配置 `colWidths` 则跳过

### 4.3 复制/粘贴

- 复制：直接返回单元格数据（所有单元格已是 JSON 字符串，无需转换）
- 粘贴：粘贴的文本直接作为新值写入单元格

### 4.4 级联更新

子 Slot 数据变更后，向上更新父单元格，级联传递直至根节点。`source: 'cascade'` 标记防止触发子 Slot 自动折叠逻辑。

### 4.5 子 Slot 自动管理

- **单元格编辑/删除/粘贴**：自动折叠（销毁）其展开的子 Slot
- **数组行拖拽**：拖拽前清除所有子 Slot，重排后级联更新父单元格
- **内联编辑提交**：回写后触发完整渲染管线，确保按钮与截断正确显示

### 4.6 类型系统

统一类型缩写：

| 缩写 | 含义 |
|------|------|
| `str` | 字符串 |
| `int` | 整数 |
| `num` | 浮点数 |
| `bool` | 布尔值 |
| `obj` | 普通对象 |
| `arr` | 数组（元素非全数组） |
| `mat` | 矩阵（元素均为数组） |
| `any` | null / undefined / 未知 |

列类型推导：先由原始值获得基准类型，仅当基准为 `any` 时由 JSON Schema type 覆盖。

---

## 5. 数据模型

```js
S = {
  root: { $schema: null, data: null }
}
```

- `S.root.$schema` — 根级别 JSON Schema
- `S.root.data` — 根级别 JSON 数据

每个 Slot DOM 元素的关键属性：
- `_raw` — 当前编辑的原始 JSON 值
- `_type` — 值类型缩写
- `_hot` — Handsontable 实例引用
- `_view` — 当前激活视图
- `_parentRow` / `_parentCol` / `_parentHot` — 父表格引用，用于级联更新和 DOM 排序
- `_path` — 路径数组，根为 `['$']`