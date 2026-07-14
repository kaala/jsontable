# 实现提纲

## 文件结构

单文件 `index.html`，分 5 个代码段，共 23 个函数：

| 段 | 内容 | 函数 |
|----|------|------|
| 1. Utils | 工具函数 | `tryParse`, `esc`, `typeOf`, `formatJSON`, `pathStr` |
| 2. Schema | 列配置推导 | `getSchema`, `colDef`, `tableColumns` |
| 3. Hot | 表格工厂与渲染器 | `makeHot`, `cellRenderer`, `readData` |
| 4. Slot | Slot 生命周期、DOM、视图、数据读写、单元格展开/折叠 | `findSlot`, `createSlot`, `switchView`, `buildHot`, `saveSlot`, `cascadeUp`, `destroySlot`, `clearChildren`, `cellPath`, `expandCell`, `collapseCell` |
| 5. Init | 全局状态与初始化 | `init`（+ `S` 全局对象） |

---

## DOM 结构

```
<body>
  <div id="app">
    <!-- Slots 动态插入此处，嵌套结构 -->
  </div>
  <template id="slot-template">
    <div class="slot">
      <div class="slot-head">
        <span class="slot-path"></span>        <!-- 路径显示，如 $.data.items[0].name -->
        <span class="btn slot-btn-table">TABLE</span>
        <span class="btn slot-btn-text">TEXT</span>
        <span class="btn slot-btn-raw">RAW</span>
        <span class="btn slot-btn-collapse">[-]</span>
      </div>
      <div class="slot-body">
        <div class="slot-hot"></div>            <!-- Handsontable 容器 -->
        <textarea class="slot-txt slot-txt-text"></textarea>   <!-- TEXT 视图 -->
        <textarea class="slot-txt slot-txt-raw"></textarea>    <!-- RAW 视图 -->
      </div>
      <div class="slot-children"></div>          <!-- 子 Slot 插入此处 -->
    </div>
  </template>
</body>
```

### 按钮可见性

| 类型 | TABLE | TEXT | RAW | [-] |
|------|-------|------|-----|-----|
| obj / arr / mat | 显示 | 隐藏 | 显示 | 显示 |
| str | 隐藏 | 显示 | 显示 | 显示 |
| int / num / bool / any | 隐藏 | 隐藏 | 显示 | 显示 |
| root | 显示 | 隐藏 | 显示 | 隐藏（`noCollapse: true`） |

### 视图切换流程

```
switchView(el, 'table'):
  1. 如果当前视图与目标相同 → 直接返回
  2. saveSlot(el) 保存当前视图数据到 _raw
  3. 如果当前是 TABLE → clearChildren(el) 清理子 Slot，销毁 Hot
  4. 隐藏所有视图 DOM
  5. 显示目标视图 DOM
  6. 根据目标视图初始化内容：
      - table → buildHot(el)（创建新 Hot 实例）
      - text  → textarea.value = String(_raw)
      - raw   → textarea.value = formatJSON(_raw)（或 JSON.stringify 用于原始类型）
  7. 高亮对应按钮（toggle .active class）
```

---

## 核心实现逻辑

### typeOf（类型检测）

统一返回缩写，项目内所有类型比较均使用缩写：

| 缩写 | 含义 |
|------|------|
| `str` | 字符串 |
| `int` | 整数 |
| `num` | 浮点数 |
| `bool` | 布尔值 |
| `obj` | 普通对象 |
| `arr` | 数组（元素非全数组） |
| `mat` | 矩阵（元素均为数组） |
| `any` | null / undefined |

### colDef（列类型推导）

1. 从 raw value 通过 `typeOf` 获取基准类型
2. 若基准类型为 `any` 且存在 schema，从 JSON Schema type 推导（通过 `ST` 查找表桥接）
3. 返回 `{ type, coldef }`，bool 类型自动配置 dropdown

### tableColumns（列配置生成）

结合 JSON Schema 和 raw data，返回 Handsontable 列配置：

- **object**：合并 raw keys 和 schema.properties 为列头，每列调用 `colDef` 获取类型与 coldef
- **array（元素均为 object 或 schema 定义为 object）**：合并所有元素的 key 和 schema.items.properties 为列头
- **其他 array/matrix**：不生成多列配置

返回 `{ keys, headers, columns }`（object）或 `{ items: { keys, headers, columns } }`（array-of-objects）。

### buildHot（构建子表格）

根据 `_type` 和 `_raw` 内联创建不同形态的 Handsontable：

1. **obj** → 单行，key 为列头（带类型标注如 `name (str)`），每列值 = `JSON.stringify(raw[key])`
2. **mat** → 多行多列，行列表头，`manualRowMove`，`minSpareRows: 2`，`minSpareCols: 3`
3. **arr** → 判定 empty / object items / primitive items：
   - empty → 单行表
   - object items → 多列，收集所有 key 为列头，每行每列值 = `JSON.stringify(item[key])`
   - primitive items → 单列，每行值 = `JSON.stringify(item)`
4. **其他** → 单单元格，值 = `JSON.stringify(raw)`

全局配置通过 `makeHot` 统一注入：`licenseKey`、`width: 'auto'`、`height: 'auto'`、`manualColumnResize: true`、`outsideClickDeselects: false`、`contextMenu: false`、`editor: 'text'`。

Hot 钩子（全部使用闭包捕获的 `hot` 和 `el`，不用 `this`）：
- `afterOnCellMouseDown` → 在 `[+]`/`[-]` 按钮上触发 `expandCell` / `collapseCell`
- `beforeChange`（非 loadData/cascade 源）→ 遍历 changes，对被修改单元格调用 `destroySlot` 折叠子 Slot
- `afterChange`（非 loadData 源）→ 读取 Hot 更新 `_raw`，若为 root 则同步 `S.root.$schema` 和 `S.root.data`，否则 `cascadeUp`
- arr / mat 类型额外注册 `beforeRowMove`（清理子 Slot）+ `afterRowMove`（级联更新）

### readData（从表格读取数据）

以前是 `readHot`（包装 `readData`），现合并为一个函数，直接接收 `(hot, type, keys)`：

- **obj** → 遍历列头，每列 `tryParse(cellValue)` 恢复到原始值
- **mat** → 过滤每行尾部空值，逐格 `tryParse`，过滤尾部空行
- **arr** → 过滤空行，multi-key 模式按 key 重建 object，否则 `tryParse` 每个元素
- **其他** → `tryParse(data[0][0])`

### cellRenderer（单元格渲染器）

自定义渲染器，在 `TextRenderer` 基础上叠加 `[+]`/`[-]` 按钮：
- 超长内容（>100 字符）截断为前 35 字符 + `...`，并设置 `td.title`（显示 `formatJSON` 结果）
- 按钮状态由 `cellProperties._expanded` 控制

### createSlot（Slot 工厂）

1. 从 `<template>` clone DOM
2. 根据 options 设置属性（`_raw`, `_type`, `_path`, `_parentRow`, `_parentCol`, `_parentHot`）
3. 根据类型设置按钮可见性
4. 绑定按钮事件
5. 按 `(parentRow, parentCol)` 排序插入父容器（保证数组子 Slot 按序号排列）

### 级联更新链

```
afterChange（子 Hot）
  → readData → _raw 更新
  → cascadeUp(el)
    → _parentHot.setDataAtCell(_parentRow, _parentCol, JSON.stringify(_raw), 'cascade')
      → 触发父 Hot 的 beforeChange（source='cascade'，跳过折叠逻辑）
      → 触发父 Hot 的 afterChange
        → readData → 父 _raw 更新
        → 继续 cascadeUp...
```

### destroySlot（Slot 销毁）

```
destroySlot(el):
  1. saveSlot(el)          // 保存当前 _raw
  2. clearChildren(el)     // 深度优先递归销毁所有子 Slot
  3. 销毁 _hot 实例
  4. cascadeUp(el)         // 将最新 _raw 写回父单元格
  5. 清除父 Hot 的 cellMeta（_expanded = false, _slot = null）
  6. el.remove()           // 从 DOM 移除
```

`saveSlot` 已内聚到 `destroySlot` 中，调用方无需手动保存。

---

## 全局状态

```js
var S = { root: { $schema: null, data: null } };
```

根路径为 `['$']`。所有 Hot 实例和 Slot 元数据直接挂在对应 DOM 元素上（`_hot`, `_raw`, `_type`, `_view` 等），通过 `findSlot(hot)` 向上遍历 DOM 树查找所属 Slot。
