# 实现提纲

## 文件结构

单文件 `index.html`，分 8 个代码段，共 18 个函数：

| 段 | 内容 | 函数 |
|----|------|------|
| 1. Helpers | 工具函数 | `tryParse`, `typeOf`, `formatJSON` |
| 2. Handsontable layer | Hot 工厂与渲染器 | `makeHot`, `cellRenderer` |
| 3. Slot — create | Slot DOM 创建与排序插入 | `createSlot` |
| 4. Slot — view | 视图切换 | `switchView` |
| 5. Slot — hot I/O | Hot 构建与数据读写 | `buildHot`, `readHot` |
| 6. Slot — lifecycle | 保存/级联/销毁/清理 | `saveSlot`, `cascadeUp`, `destroySlot`, `clearChildren` |
| 7. Cell — expand / collapse | 单元格展开/折叠 | `expandCell`, `collapseCell`, `findSlot`, `cellPath` |
| 8. Init | 全局状态与初始化 | `init`（+ `S` 全局对象） |

---

## DOM 结构

```
<body>
  <div id="app">
    <!-- Slots 动态插入此处，嵌套结构 -->
  </div>
  <template id="slot-tmpl">
    <div class="slot">
      <div class="slot-bar">
        <span class="slot-path"></span>        <!-- 路径显示，如 root.data.items[0].name -->
        <span class="btn btn-table">TABLE</span>
        <span class="btn btn-text">TEXT</span>
        <span class="btn btn-raw">RAW</span>
        <span class="btn btn-collapse">[-]</span>
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
| object / array | 显示 | 隐藏 | 显示 | 显示 |
| string | 隐藏 | 显示 | 显示 | 显示 |
| number / boolean / null | 隐藏 | 隐藏 | 显示 | 显示 |
| root | 显示 | 隐藏 | 显示 | 隐藏（`noClose: true`） |

### 视图切换流程

```
switchView(el, 'table'):
  1. 如果当前是 TABLE → 先从 Hot 读取 _raw，清理子 Slot，销毁 Hot
  2. 隐藏所有视图 DOM
  3. 显示目标视图 DOM
  4. 根据目标视图初始化内容：
     - table → buildHot(el)（创建新 Hot 实例）
     - text  → textarea.value = String(_raw)
     - raw   → textarea.value = formatJSON(_raw)
  5. 高亮对应按钮
```

---

## 核心实现逻辑

### buildHot（构建子表格）

根据 `_type` 和 `_raw` 创建不同形态的 Handsontable：

1. **object** → 单行，key 为列头，每列值 = `JSON.stringify(raw[key])`
2. **array** → 判定元素是否全为 object：
   - 是 → 多列，收集所有 key 为列头，每行每列值 = `JSON.stringify(item[key])`
   - 否 → 单列，每行值 = `JSON.stringify(item)`
3. **其他** → 单单元格，值 = `JSON.stringify(raw)`

全局配置通过 `makeHot` 统一注入：`licenseKey`、`width: 'auto'`、`height: 'auto'`、`manualColumnResize: true`、`outsideClickDeselects: false`、`contextMenu: false`、`editor: 'text'`。

Hot 钩子：
- `beforeCopy` → 直接返回 data（透传）
- `beforePaste` → 直接返回 data（透传）
- `beforeChange`（非 loadData/cascade 源）→ 遍历 changes，折叠被修改单元格的子 Slot
- `afterChange`（非 loadData 源）→ 读取 Hot 更新 `_raw`，若为 root 则同步 `S.root.$schema` 和 `S.root.data`，否则 `cascadeUp`
- array 类型额外注册 `beforeRowMove`（清理子 Slot）+ `afterRowMove`（级联更新）

### readHot（从表格读取数据）

Type-specific 解析逻辑：

- **object** → 遍历列头，每列 `tryParse(cellValue)` 恢复到原始值
- **array** → 过滤空行，`multi` 模式按 key 重建 object，否则 `tryParse` 每个元素
- **其他** → `tryParse(data[0][0])`

### cellRenderer（单元格渲染器）

自定义渲染器，在 `TextRenderer` 基础上叠加 `[+]`/`[-]` 按钮：
- 超长内容（>80 字符）截断并设置 `td.title`
- 按钮绑定 `mousedown` 事件，调用 `expandCell` 或 `collapseCell`
- 按钮状态由 `cellProperties._expanded` 控制

### createSlot（Slot 工厂）

1. 从 `<template>` clone DOM
2. 根据 options 设置属性（`_raw`, `_type`, `_parentRow`, `_parentCol`, `_parentHot`, `_isMultiCol`）
3. 根据类型设置按钮可见性
4. 绑定按钮事件
5. 按 `(parentRow, parentCol)` 排序插入父容器（保证数组子 Slot 按序号排列）

### 级联更新链

```
afterChange（子 Hot）
  → readHot → _raw 更新
  → cascadeUp(el)
    → _parentHot.setDataAtCell(_parentRow, _parentCol, JSON.stringify(_raw), 'cascade')
      → 触发父 Hot 的 beforeChange（source='cascade'，跳过折叠逻辑）
      → 触发父 Hot 的 afterChange
        → readHot → 父 _raw 更新
        → 继续 cascadeUp...
```

### destroySlot（Slot 销毁）

```
destroySlot(el):
  1. clearChildren(el)      // 深度优先递归销毁所有子 Slot
  2. 销毁 _hot 实例
  3. cascadeUp(el)          // 将最新 _raw 写回父单元格
  4. 清除父 Hot 的 cellMeta（_expanded = false, _slot = null）
  5. el.remove()            // 从 DOM 移除
```

### saveSlot（保存当前视图数据到 _raw）

- TEXT 视图 → `_raw = _textTA.value`
- RAW 视图 → `_raw = tryParse(_rawTA.value)`
- TABLE 视图 → `_raw = readHot(_hot, _type, _isMultiCol)`

---

## 全局状态

```js
var S = { root: { $schema: null, data: null } };
```

无独立实例管理数组。所有 Hot 实例和 Slot 元数据直接挂在对应 DOM 元素上（`_hot`, `_raw`, `_type`, `_view` 等），通过 `findSlot(hot)` 向上遍历 DOM 树查找所属 Slot。
