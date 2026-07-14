# JSON Table Editor — 需求说明书

## 1. 项目概述

**目标**：纯前端、单 HTML 文件的 JSON 可视化编辑器，以电子表格形式编辑嵌套 JSON 数据。

**交付形态**：单个 `.html` 文件，CDN 加载 Handsontable 14.6，零编译零构建，原生 JavaScript。

---

## 2. 技术约束

| 约束 | 说明 |
|------|------|
| **框架** | 无框架，纯原生 JavaScript |
| **构建** | 无编译、无打包 |
| **表格库** | Handsontable 14.6（CDN，非商业许可） |
| **字体** | `monospace`（13px） |
| **主题** | Light 主题，极简 CSS |
| **文件** | 单 HTML 文件自包含 |

---

## 3. 核心架构

### 3.1 Slot 模型

整个编辑器基于 **Slot（槽位）** 概念构建。每个 Slot 代表一个 JSON 节点的编辑容器，形成与 JSON 结构对应的嵌套树。

- **根 Slot**：页面加载即创建，路径 `$`，包含 `$schema` 和 `data` 两列，存储原始解析后的值（非字符串）
- **子 Slot**：通过单元格 `[+]` 按钮展开创建，支持无限嵌套
- 所有 Slots 按 `(parentRow, parentCol)` 排序插入 DOM，保证渲染顺序与表格位置一致

### 3.2 三种视图

每个 Slot 提供三种视图，各有独立的 DOM 元素，通过 show/hide 切换，**视图间无需数据同步**（只在切换时一次性读取/写入）：

| 视图 | 按钮 | 可见条件 | 说明 |
|------|------|---------|------|
| **TABLE** | TABLE | obj / arr / mat | Handsontable 子表格，结构化编辑 |
| **TEXT** | TEXT | 仅 str | 原始字符串 textarea，无引号无转义 |
| **RAW** | RAW | 所有类型 | JSON 格式 textarea，显示 `formatJSON` 输出 |

### 3.3 数据存储

- 所有 Handsontable 单元格值均为 **JSON 文本字符串**（display = value），通过 `JSON.stringify` 存入
- Slot 的 `_raw` 属性存储原始解析后的值（obj/arr/mat/str/int/num/bool/any）
- 根 Slot 的 `_raw` 直接映射到全局 `S.root`
- 读写时通过 `readData` 解析单元格字符串为原始值，通过 `buildHot` 将原始值序列化进表格

---

## 4. 关键行为

### 4.1 表格形态

| JSON 类型 | 表格形态 | 配置 |
|-----------|---------|------|
| **obj** | 单行，属性名为列头（带类型标注） | `colHeaders: keys`，每列 `renderer: cellRenderer` |
| **mat**（元素均为 arr 的 arr） | 多行多列表格 | `rowHeaders: true`，`colHeaders: true`，`minSpareRows: 2`，`minSpareCols: 3`，`manualRowMove: true` |
| **arr（元素均为 obj）** | 多列，自动合并所有对象的 key 为列头（带类型标注） | `rowHeaders: true`，`minSpareRows: 2`，`manualRowMove: true` |
| **arr（其他）** | 单列，行表头 | `rowHeaders: true`，`minSpareRows: 2`，`manualRowMove: true` |
| **原始类型** | 单单元格 | 无行/列表头 |

### 4.2 单元格操作

- **`[+]` 按钮**：解析单元格 JSON 字符串为原始值，创建子 Slot，若为 obj/arr/mat 则默认切换到 TABLE 视图，若为 str 则默认切换到 TEXT 视图，否则切换到 RAW 视图
- **`[-]` 按钮**：销毁子 Slot 及其所有后代（`destroySlot` 内部自动调用 `saveSlot`），父单元格恢复折叠状态
- **内联编辑**：双击进入 Handsontable 编辑器，编辑的是 JSON 字符串
- **超长文本**：>100 字符时截断显示前 35 字符 + `...`，hover 显示完整格式化内容

### 4.3 复制/粘贴

- `beforeCopy`：直接返回数据（所有单元格已是 JSON 字符串，无需转换）
- `beforePaste`：直接返回数据（粘贴的文本直接作为新值写入单元格）

### 4.4 级联更新

子 Slot 数据变更后，通过 `cascadeUp` 向上调用 `setDataAtCell(row, col, JSON.stringify(_raw), 'cascade')` 更新父单元格，`source: 'cascade'` 标记防止触发 `beforeChange` 的子 Slot 自动折叠逻辑。

### 4.5 子 Slot 自动管理

- **`beforeChange`**：当父单元格被编辑、删除、粘贴时，自动折叠（`destroySlot`）其展开的子 Slot
- **`beforeRowMove`**：数组行拖拽前，先清除所有子 Slot（`clearChildren`），重排后通过 `afterRowMove` 级联更新父单元格

### 4.6 类型系统

`typeOf` 统一返回缩写，整个项目使用统一类型名：

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

列类型通过 `colDef(schema, val)` 推导：先由 raw value 获得基准类型，仅当基准为 `any` 时由 JSON Schema type 覆盖（通过 `ST` 查找表桥接标准类型名到缩写）。

---

## 5. 数据模型

```js
S = {
  root: { $schema: null, data: null }
}
```

- `S.root.$schema` — 根级别 JSON Schema（存原始值）
- `S.root.data` — 根级别 JSON 数据（存原始值）

每个 Slot DOM 元素的关键属性：
- `_raw` — 当前编辑的原始 JSON 值
- `_type` — 值类型缩写（'obj' | 'arr' | 'mat' | 'str' | 'int' | 'num' | 'bool' | 'any'）
- `_hot` — Handsontable 实例引用
- `_view` — 当前激活视图（'table' | 'text' | 'raw'）
- `_parentRow` / `_parentCol` / `_parentHot` — 父表格引用，用于级联更新和 DOM 排序
- `_path` — 路径数组，根为 `['$']`
