# 实现提纲

## DOM 结构

```
<body>
  <div id="app">
    <div id="root-hot"></div>
    <div id="slots"></div>
  </div>
  <template id="slot-tmpl">
    <div class="slot">
      <div class="slot-toolbar">
        <button class="btn-table">TABLE</button>
        <button class="btn-json">JSON</button>
        <button class="btn-raw">RAW</button>
        <button class="btn-collapse">[-]</button>
      </div>
      <div class="slot-hot"></div>
      <textarea class="slot-textarea"></textarea>
    </div>
  </template>
</body>
```

Slot 通过 `tmpl.content.cloneNode(true)` 实例化。按钮均为纯文本样式（无边框、无背景），active 状态用下划线表示。

按钮可见性按类型：

| 类型 | Table | JSON | Raw |
|------|-------|------|-----|
| object / array | ✅（默认） | ✅ | ❌ |
| string | ❌ | ✅ | ✅（默认） |
| number / boolean / null | ❌ | ✅（默认） | ❌ |

---

## 数据模型

```
S = {
  root: { $schema: {}, data: {} },
  instances: []   // 所有 Hot 实例 { hot, container, parentSlot }
}
```

---

## 伪代码

```
// ============================================================
// 工具函数
// ============================================================

// 判断值类型，返回 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
function getType(value)

// 判断 number 是否为整数
function isInteger(value)

// 自定义格式化：object 每 key 一行，array 每元素一行，
// 值内部不换行（非标准 JSON.stringify）
function formatJSON(value)
  if object:
    lines = ["{"]
    for each key:
      lines.push('"' + key + '": ' + JSON.stringify(value[key]))
    lines.push("}")
    return lines.join("\n")

  if array:
    lines = ["["]
    for each element:
      lines.push(JSON.stringify(element))
    lines.push("]")
    return lines.join("\n")

  // 原始类型直接用 JSON.stringify
  return JSON.stringify(value)

// ============================================================
// Schema 自动推导
// ============================================================

function deriveSchema(data)
  if data is null: return {}           // null 不推导
  if data is array:
    itemSchema = data.length > 0 ? deriveSchema(data[0]) : {}
    return { type: "array", items: itemSchema }

  if data is object:
    props = {}
    for each key in data:
      props[key] = deriveSchema(data[key])
    return { type: "object", properties: props }

  if data is string:  return { type: "string" }
  if data is number:  return { type: isInteger(data) ? "integer" : "number" }
  if data is boolean: return { type: "boolean" }
  return {}

// 合并 schema：手动值优先（不覆盖已有 key）
function mergeSchema(existing, derived)
  for each key in derived:
    if key not in existing: existing[key] = derived[key]

// 触发推导：data 变更时调用
function autoDerive()
  derived = deriveSchema(S.root.data)
  mergeSchema(S.root.$schema, derived)
  // 更新根表格 $schema 列的显示
  refreshRootSchemaCell()

// ============================================================
// 列头类型提示
// ============================================================

function getTypeHint(schemaValue)
  if schemaValue.type == "string":   return "(str)"
  if schemaValue.type == "integer":  return "(int)"
  if schemaValue.type == "number":   return "(num)"
  if schemaValue.type == "boolean":  return "(bool)"
  if schemaValue.type == "object":   return "(obj)"
  if schemaValue.type == "array":    return "(arr)"
  // enum 通过 enum 字段判断
  if schemaValue.enum:              return "(enum)"
  return ""

// object 子表格列头：keyName + typeHint
function buildObjectHeaders(objData, schema)
  for each key in objData:
    hint = getTypeHint(schema.properties?.[key] || {})
    headers.push(key + " " + hint)

// ============================================================
// Handsontable 工厂
// ============================================================

function createHot(container, config)
  hot = new Handsontable(container, config)
  S.instances.push({ hot, container, parentSlot: config.parentSlot })
  return hot

function destroyHot(hot)
  hot.destroy()
  S.instances = S.instances.filter(inst => inst.hot !== hot)

// ============================================================
// 根表格
// ============================================================

function initRootTable()
  data = [
    [S.root.$schema, S.root.data]   // 每个单元格存 JSON 值
  ]

  hot = createHot(document.getElementById('root-hot'), {
    data: data,
    colHeaders: ['$schema', 'data'],
    columns: [
      {},  // $schema 列
      {}   // data 列
    ],
    minSpareCols: 0,
    // ... 其他配置
  })
  return hot

// ============================================================
// 单元格渲染：JSON.stringify(value) + 绝对定位按钮
// ============================================================

function cellRenderer(instance, td, row, col, prop, value, cellProperties)
  str = JSON.stringify(value)
  truncated = str.length > 80 ? str.slice(0, 80) + '…' : str
  isExpanded = cellProperties._expanded

  td.innerHTML = truncated +
    '<button class="cell-btn">' + (isExpanded ? '[-]' : '[+]') + '</button>'
  if str.length > 80: td.title = str

  // 按钮事件：mousedown 上绑定 expandCell / collapseCell
  btn = td.querySelector('.cell-btn')
  btn.onmousedown = function(e) {
    e.stopPropagation(); e.preventDefault()
    if isExpanded: collapseCell(hotInstance, row, col)
    else: expandCell(hotInstance, row, col, value)
  }

// 按钮 CSS：position: absolute; right: 2px; top: 50%; transform: translateY(-50%);

// ============================================================
// 内联编辑：双击进入 Handsontable 编辑器
// ============================================================

// beforeChange 回调
function onBeforeChange(changes, source)
  for each [row, col, oldValue, newValue] in changes:
    if newValue is string:
      try:
        parsed = JSON.parse(newValue)
        changes[i][3] = parsed   // 解析成功，写入解析后的值
      catch:
        changes[i][3] = newValue // 解析失败，保留为 string

// ============================================================
// Delete 键 → 清空为 null
// ============================================================

// beforeKeyDown
function onBeforeKeyDown(event)
  if event.key == 'Delete':
    // 如果选中了单元格，将其值设为 null
    // 在 beforeChange 中不额外处理

// ============================================================
// 展开 / 收起
// ============================================================

// cellMeta: 每个单元格的元数据
// { value: JSON值, typeHint: schema信息, expanded: false, slotEl: null }

function expandCell(hot, row, col, cellValue)
  type = getType(cellValue)

  // Clone from template
  slotEl = document.getElementById('slot-tmpl').content.cloneNode(true).querySelector('.slot')
  slotEl.dataset.parentHotId = hot.hotId
  slotEl.dataset.cellRow = row
  slotEl.dataset.cellCol = col
  slotEl.dataset.valueType = type
  document.getElementById('slots').appendChild(slotEl)

  // 根据类型设置按钮可见性（不预置 _activeView）
  if type == 'object' || type == 'array':
    slotEl.querySelector('.btn-table').style.display = ''
    slotEl.querySelector('.btn-json').style.display = ''
    slotEl.querySelector('.btn-raw').style.display = 'none'
  elif type == 'string':
    slotEl.querySelector('.btn-table').style.display = 'none'
    slotEl.querySelector('.btn-json').style.display = ''
    slotEl.querySelector('.btn-raw').style.display = ''
  else:
    slotEl.querySelector('.btn-table').style.display = 'none'
    slotEl.querySelector('.btn-json').style.display = ''
    slotEl.querySelector('.btn-raw').style.display = 'none'

  // 绑定按钮事件
  slotEl.querySelector('.btn-table').onmousedown = function() { activateTableView(slotEl) }
  slotEl.querySelector('.btn-json').onmousedown   = function() { activateJSONView(slotEl) }
  slotEl.querySelector('.btn-raw').onmousedown    = function() { activateRawView(slotEl) }
  slotEl.querySelector('.btn-collapse').onmousedown = function() { collapseCell(hot, row, col) }

  // 根据类型渲染默认视图（activate 函数内设置 _activeView）
  if type == 'object' || type == 'array':
    activateTableView(slotEl)
  elif type == 'string':
    activateRawView(slotEl, cellValue)
  else:
    activateJSONView(slotEl, cellValue, type)

  setCellMeta(hot, row, col, 'expanded', true)
  setCellMeta(hot, row, col, 'slotEl', slotEl)

function collapseCell(hot, row, col)
  meta = getCellMeta(hot, row, col)
  slotEl = meta.slotEl

  // 如果当前是 textarea 视图（JSON 或 Raw），先 sync
  if slotEl._activeView == 'json' || slotEl._activeView == 'raw':
    syncTextareaToData(slotEl)

  // 销毁子表格（如果有）
  if slotEl._childHot:
    destroyHot(slotEl._childHot)

  // 移除 slot DOM
  slotEl.remove()

  // 重新计算父表列宽
  hot.refreshDimensions()

  // 清除元数据
  setCellMeta(hot, row, col, 'expanded', false)
  setCellMeta(hot, row, col, 'slotEl', null)

// ============================================================
// 三种视图激活
// ============================================================

// Table 视图 — 仅 object / array
function activateTableView(slotEl, value, type, parentHot, parentRow, parentCol)
  // 如果已激活，跳过
  if slotEl._activeView == 'table': return

  // 切换到文字视图前，先同步 textarea 数据
  if slotEl._activeView == 'json' || slotEl._activeView == 'raw':
    syncTextareaToData(slotEl)

  // 销毁旧子表格（如有）
  if slotEl._childHot: destroyHot(slotEl._childHot)

  slotEl.querySelector('.slot-hot').style.display = 'block'
  slotEl.querySelector('.slot-textarea').style.display = 'none'

  schema = getSchemaForCell(parentHot, parentRow, parentCol)

  if type == 'object':
    keys = Object.keys(value)
    rowData = keys.map(k => value[k])
    colHeaders = buildObjectHeaders(value, schema)
    hot = createHot(slotEl.querySelector('.slot-hot'), {
      data: [rowData],
      colHeaders: colHeaders,
      rowHeaders: false,
      minSpareCols: 1,
      columns: keys.map(k => ({})),
    })

  if type == 'array':
    hot = createHot(slotEl.querySelector('.slot-hot'), {
      data: value.map(item => [item]),
      colHeaders: false,
      rowHeaders: true,
      minSpareRows: 1,
      columns: [{}],
    })

  slotEl._childHot = hot

  // onChange → 级联更新
  hot.addHook('afterChange', function(changes, source) {
    if source == 'loadData': return
    newValue = extractDataFromHot(hot, type)
    updateParentCell(parentHot, parentRow, parentCol, newValue)
    autoDerive()
  })

  // afterRowMove → sync
  if type == 'array':
    hot.addHook('afterRowMove', function(...) {
      newValue = extractDataFromHot(hot, type)
      updateParentCell(parentHot, parentRow, parentCol, newValue)
    })

  slotEl._activeView = 'table'
  highlightActiveButton(slotEl)

// JSON 视图 — 所有类型，显示 formatJSON / JSON.stringify 后的文本
function activateJSONView(slotEl, value, type)
  if slotEl._activeView == 'json': return

  // 从 Table 切换过来时，先从子表格读取最新数据
  if slotEl._activeView == 'table' && slotEl._childHot:
    value = extractDataFromHot(slotEl._childHot, type)
    destroyHot(slotEl._childHot)
    slotEl._childHot = null

  // 从 Raw 切换过来时，先 sync textarea
  if slotEl._activeView == 'raw':
    syncTextareaToData(slotEl)
    value = slotEl._textareaValue

  slotEl.querySelector('.slot-hot').style.display = 'none'
  textarea = slotEl.querySelector('.slot-textarea')
  textarea.style.display = 'block'
  textarea._mode = 'json'

  if type == 'object' || type == 'array':
    textarea.value = formatJSON(value)
  else:
    textarea.value = JSON.stringify(value)   // 包括 string：带双引号

  textarea._value = value
  textarea._type = type
  slotEl._activeView = 'json'
  highlightActiveButton(slotEl)

// Raw 视图 — 仅 string 类型，原始内容无引号无转义
function activateRawView(slotEl, initialValue)
  if slotEl._activeView == 'raw': return

  textarea = slotEl.querySelector('.slot-textarea')

  // 初始展开：直接使用传入的 string 值
  if initialValue != undefined:
    textarea._value = initialValue
  // 从 JSON 视图切换过来
  elif slotEl._activeView == 'json':
    try:
      parsed = JSON.parse(textarea.value)
      textarea._value = parsed
    catch:
      textarea._value = textarea.value
  // 从 Table 切换过来（不会发生，但防御一下）
  elif slotEl._activeView == 'table' && slotEl._childHot:
    textarea._value = extractDataFromHot(slotEl._childHot, 'string')
    destroyHot(slotEl._childHot)
    slotEl._childHot = null

  slotEl.querySelector('.slot-hot').style.display = 'none'
  textarea.style.display = 'block'
  textarea.value = textarea._value    // 原始字符串内容
  textarea._mode = 'raw'
  slotEl._activeView = 'raw'
  highlightActiveButton(slotEl)

// ============================================================
// 高亮当前活动按钮
// ============================================================

function highlightActiveButton(slotEl)
  slotEl.querySelector('.btn-table').classList.toggle('active', slotEl._activeView == 'table')
  slotEl.querySelector('.btn-json').classList.toggle('active', slotEl._activeView == 'json')
  slotEl.querySelector('.btn-raw').classList.toggle('active', slotEl._activeView == 'raw')

// ============================================================
// textarea 数据同步
// ============================================================

function syncTextareaToData(slotEl)
  textarea = slotEl.querySelector('.slot-textarea')
  raw = textarea.value

  if textarea._mode == 'raw':
    // Raw 模式：textarea 内容就是字符串值，无需 parse
    textarea._value = raw
  else:
    // JSON 模式：尝试 JSON.parse
    try:
      textarea._value = JSON.parse(raw)
    catch:
      textarea._value = raw   // parse 失败，保留 string

  // 更新父单元格
  parentHot = findParentHot(slotEl)
  row = slotEl.dataset.cellRow
  col = slotEl.dataset.cellCol
  updateParentCell(parentHot, row, col, textarea._value)
  autoDerive()

// ============================================================
// 复制 / 粘贴
// ============================================================

// beforeCopy
function onBeforeCopy(data, coords)
  // 所有单元格已是 JSON.stringify 字符串，直接返回
  return data   // 无需额外转换

// beforePaste
function onBeforePaste(data, coords)
  for each cell in data:
    try:
      data[i] = JSON.parse(cell)
    catch:
      data[i] = cell   // 保留为 string
  return data

// ============================================================
// 列宽裁剪（防循环）
// ============================================================

function capColumnWidths(hot)
  widths = []
  changed = false
  cols = hot.countCols()
  for i = 0 to cols-1:
    w = hot.getColWidth(i)
    widths.push(w > 320 ? 320 : w)
    if w > 320: changed = true
  if changed: hot.updateSettings({ colWidths: widths })

// afterRender 中调用
hot.addHook('afterRender', function() {
  capColumnWidths(this)
})

// ============================================================
// 行操作
// ============================================================

// afterRowMove → 更新父单元格

// 清理末尾空行（带 _cleaning 守卫防递归）
function cleanupEmptyRows(hot)
  if hot._cleaning: return
  hot._cleaning = true
  data = hot.getData()
  lastDataRow = -1
  for i = 0 to data.length - 1:
    if data[i] 非全空: lastDataRow = i
  removeFrom = lastDataRow + 2
  while hot.countRows() > removeFrom:
    hot.alter('remove_row', hot.countRows() - 1)
  hot._cleaning = false

// ============================================================
// 级联更新
// ============================================================

function updateParentCell(parentHot, row, col, newValue)
  parentHot.setDataAtCell(row, col, newValue)
  // setDataAtCell 触发 afterChange，如果还有上层，继续向上传递

// ============================================================
// 初始化
// ============================================================

function init()
  S.root.$schema = {}
  S.root.data = {}

  rootHot = initRootTable()

  // 根表格 afterChange → autoDerive
  rootHot.addHook('afterChange', function(changes, source) {
    if source == 'loadData' || source == 'edit-prep' || source == 'cascade' || source == 'schema-refresh': return
    // Try JSON.parse on changed values
    autoDerive()
  })

document.addEventListener('DOMContentLoaded', init)
```
