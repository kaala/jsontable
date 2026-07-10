# JSON Table Editor — 需求说明书

## 1. 项目概述

**目标**：构建一个纯前端、单 HTML 文件的 JSON 可视化编辑器，以电子表格形式呈现嵌套 JSON，支持 JSON Schema 类型引导。

**交付形态**：单个 `.html` 文件，CDN 加载 Handsontable，无需编译构建。

---

## 2. 技术约束

| 约束 | 说明 |
|------|------|
| **框架** | 零框架 —— 纯原生 JavaScript（无 React/Vue 等） |
| **构建** | 无编译、无打包 |
| **表格库** | Handsontable 14.6（CDN，classic 主题，非商业许可） |
| **字体** | `monospace`（13px） |
| **主题** | Light 主题，极简 CSS，尽量使用 Handsontable 原生样式 |
| **文件** | 单 HTML 文件自包含 |

---

## 3. 核心功能需求

### 3.1 根表格 (Root Table)

- 页面加载即显示一个 2 列 1 行的表格：

  | `$schema` | `data` |
  |-----------|--------|
  | 空object  | 空object |

- **`$schema`**：可选的 JSON Schema 对象，用于类型引导（不做校验），初始为空 object
- **`data`**：待编辑的 JSON 数据，初始为空 object

### 3.2 类型与表格形态

| JSON 类型 | 表格形态 | 表头 | 新增行列方式 |
|-----------|---------|------|-------------|
| **object** | 单行表格 | 属性名作为列头 | `minSpareCols`（快速新增属性列） |
| **array** | 多行表格 | 序号作为行表头 (rowHeaders) | `minSpareRows`（快速新增行） |
| **原始类型**（string / number / boolean / null） | 单元格内直接编辑 | — | — |
| **matrix**（`$type: "matrix"`） | 无表头的二维网格 | 无表头 | `minSpareRows` + `minSpareCols` |

**类型解析优先级**：Schema 定义 (`$type` / `type`) → 运行时值类型 → 回退 string。类型仅用于结构引导（object/array 展开子表格，原始类型展开 textarea，以及列头类型提示），**不做校验**。

### 3.3 编辑与展开

所有单元格以 `JSON.stringify` 后的字符串形式存储和展示，编辑、复制、粘贴均基于该字符串。

#### 3.3.1 内联编辑
- **双击/Enter**：进入 Handsontable 内联编辑模式，编辑前自动将单元格值 `JSON.stringify` 为字符串供编辑。
- **确认编辑**：对编辑后的文本尝试 `JSON.parse`，解析成功则替换为解析后的值（自动识别类型）；解析失败则保留为 string。
- **Delete 键**：清空单元格内容为 `null`。

#### 3.3.2 展开 / 收起

| 值类型 | `[+]` 默认展开为 | 可切换至 |
|--------|-----------------|---------|
| object / array | 结构化子表格 | `<textarea>`（JSON 文本） |
| string | `<textarea>`（Raw 模式） | JSON 模式 |
| number / boolean / null | `<textarea>`（JSON 文本） | — |

- **`[+]` 按钮**：在父表格下方展开对应视图。
- **`[-]` 按钮**：收起当前视图，销毁子表格/textarea。收起前若为 textarea，自动 `JSON.parse`。
- **切换按钮**：object/array 展开后在子表格上方提供 **TABLE** / **JSON** 切换按钮，string 类型提供 **JSON** / **RAW** 切换按钮，切换时保持数据同步。

**JSON 文本视图**
- `<textarea>`，可 resize（480×160px 初始尺寸）。
- **格式化规则**（非标准 `JSON.stringify`）：
  - **object**：每个 key 独占一行，value 不换行。如：
    ```json
    {
    "name": "hello",
    "nested": {"a": 1, "b": [2, 3]}
    }
    ```
  - **array**：每个元素独占一行，元素内容不换行。如：
    ```json
    [
    "elem1",
    42,
    {"key": "val"}
    ]
    ```
  - **string**：两种显示模式，通过按钮切换：
    - **JSON 模式**（默认）：`JSON.stringify` 后的文本，带双引号和转义。如 `"line1\nline2"`。
    - **Raw 模式**：原始字符串内容，不带引号，无需转义。如：
      ```
      line1
      line2
      ```
  - **number / boolean / null**：直接显示 `JSON.stringify` 后的文本（`42`、`true`、`null`）。
- 可直接编辑，切换回表格视图（或收起）时尝试 `JSON.parse` 同步数据（Raw 模式收起时自动添加双引号包裹）。

**结构化表格视图**（仅 object / array）
- 展开为 Handsontable 子表格，支持结构化编辑。
- 单元格内显示 `JSON.stringify` 预览文本（截断超长内容）。

#### 3.3.3 布局与列宽

- 展开后的视图排列在父表格下方，**按数组序号顺序**排列，使用 `.slot` 容器嵌套。
- 子表格列头显示类型提示：`(str)`、`(int)`、`(num)`、`(bool)`、`(obj)`、`(arr)`、`(enum)`。
- 列宽上限 **320px**，`afterRender` 中通过 `updateSettings({ colWidths })` 裁剪超宽列。
- 超宽内容通过 `title` 属性的 tooltip 展示完整内容。
- 收起时销毁 Hot 实例/textarea，重新计算父表列宽。

### 3.4 复制/粘贴 (Copy/Paste)

- **框选复制** (`beforeCopy`)：所有单元格已是 `JSON.stringify` 后的字符串，直接复制即可。
- **框选粘贴** (`beforePaste`)：对每个单元格尝试 `JSON.parse`，解析成功则写入对应类型，失败则保留 string。
- 支持跨单元格框选、复制、粘贴操作。

### 3.5 行操作

- Array 表格支持 **行拖拽排序** (`manualRowMove`)。
- 拖拽排序后，父单元格的 `JSON.stringify` 预览文本同步更新，反映新的元素顺序。
- Array 表格自动清理末尾空行。
- 新增行通过 Handsontable 的备用行（`minSpareRows`）实现。

### 3.6 Schema 功能

- **自动推导**：当 `data` 被修改后，自动遍历其结构，为每个 object 属性的值和 array 元素生成类型描述，直接存入 `$schema`，便于展开子表时在列头看到类型提示并手动调整。
  - string → `"type": "string"`
  - number → `"type": "number"`（整数为 `"integer"`）
  - boolean → `"type": "boolean"`
  - null → 不推导类型
  - object → 递归遍历子属性
  - array → 取首个元素类型推导，标记为 `"type": "array"`
- 手动修改 `$schema` 的内容优先于自动推导。
- 通过 `$type` 扩展自定义表格类型（如 `matrix`：二维数组，无表头）。
- 扩展机制允许以统一标准模式注册和渲染自定义类型。

### 3.7 级联更新

- 子表格的修改通过 `onChange` 回调逐级向上传递。

---

## 4. 非功能需求

| 需求 | 说明 |
|------|------|
| **滚动** | 页面级水平滚动 (`body { overflow-x: auto }`)，表格内部不出现独立滚动条 |
| **UI 风格** | 极简、无多余装饰、无模态框、无右键菜单 |
| **交互反馈** | `[+]`/`[-]` 按钮为唯一展开/收起控制方式；无 Escape 快捷键 |

---

## 5. 数据模型

```js
S = {
  root: { $schema: {}, data: {} },
  instances: []  // 所有 Handsontable 实例引用
}
```

- `S.root.$schema` — 根级别的 JSON Schema
- `S.root.data` — 根级别的 JSON 数据
- `S.instances` — 用于统一管理/销毁所有表格实例

---
