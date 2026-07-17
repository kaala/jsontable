(function () {
  'use strict';

  var _injected = false;

  function ensureResources() {
    if (_injected) return;
    _injected = true;

    var style = document.createElement('style');
    style.id = 'json-table-styles';
    style.textContent =
      `.json-table-slot { margin: 0; border-left: 1px solid #ddd; padding-left: 12px; font: 13px monospace; }
.json-table-slot-root { border-left: 0; padding-left: 0; }
.json-table-slot-head { margin: 4px; }
.json-table-slot-path { font-weight: bold; margin-right: 16px; }
.json-table-slot-text { width: 600px; height: 200px; font: 13px monospace; resize: both; overflow-x: auto; white-space: pre; }
.json-table-button { cursor: pointer; padding: 0 4px; background: #eee; font: 13px monospace; user-select: none; }
.json-table-button.active { background: #00f; color: #fff; }
.handsontable td { white-space: nowrap; font: 13px monospace; line-height: 21px; }
.json-table-cell-text { padding-right: 16px; }
.json-table-cell-button { float: right; position: relative; line-height: 21px; z-index: 10; }`;
    document.head.appendChild(style);

    var tpl = document.createElement('template');
    tpl.id = 'json-table-template';
    tpl.innerHTML =
      `<div class="json-table-slot">
        <div class="json-table-slot-head">
          <span class="json-table-slot-path"></span>
          <span class="json-table-button json-table-button-table">TABLE</span>
          <span class="json-table-button json-table-button-text">TEXT</span>
          <span class="json-table-button json-table-button-raw">RAW</span>
          <span class="json-table-button json-table-button-collapse">[-]</span>
        </div>
        <div class="json-table-slot-body">
          <div class="json-table-slot-hot"></div>
          <textarea class="json-table-slot-text json-table-slot-text-text"></textarea>
          <textarea class="json-table-slot-text json-table-slot-text-raw"></textarea>
        </div>
        <div class="json-table-slot-children"></div>
      </div>`;
    document.body.appendChild(tpl);
  }

  ensureResources();

  // ============================================================
  // Constructor
  // ============================================================
  function JsonTable(container, data, schema) {
    var self = this;
    var _state = { root: null };

    // Resolve container
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container || !container.nodeType) {
      throw new Error('JsonTable: invalid container element');
    }

    // ============================================================
    // Utils
    // ============================================================
    function tryParse(s) {
      try { return JSON.parse(s); } catch (e) { return s; }
    }

    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                       .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function typeOf(v) {
      if (v == null) return 'any';
      var t = typeof v;
      if (t === 'string') return 'str';
      if (t === 'boolean') return 'bool';
      if (t === 'number') return Number.isInteger(v) ? 'int' : 'num';
      if (t === 'object') {
        if (Array.isArray(v)) {
          return v.length > 0 && v.every(function (it) { return Array.isArray(it); }) ? 'mat' : 'arr';
        }
        return 'obj';
      }
      return 'any';
    }

    function formatJSON(v) {
      var t = typeOf(v);
      var lines;
      if (t === 'obj') {
        var keys = Object.keys(v);
        if (keys.length === 0) return '{}';
        lines = keys.map(function (k) { return JSON.stringify(k) + ': ' + JSON.stringify(v[k]); });
        return '{\n' + lines.join(',\n') + '\n}';
      }
      if (t === 'arr' || t === 'mat') {
        if (v.length === 0) return '[]';
        lines = v.map(function (it) { return JSON.stringify(it); });
        return '[\n' + lines.join(',\n') + '\n]';
      }
      return JSON.stringify(v);
    }

    function pathStr(path) {
      if (!path || !path.length) return '';
      var s = path[0];
      for (var i = 1; i < path.length; i++) {
        var seg = path[i];
        if (typeof seg === 'number') s += '[' + seg + ']';
        else if (Array.isArray(seg)) s += '[' + seg.join('][') + ']';
        else s += '.' + seg;
      }
      return s;
    }

    // ============================================================
    // Schema
    // ============================================================
    function getSchema(path) {
      var schema = _state.root.$schema;
      if (!schema || typeof schema !== 'object') return null;
      if (path[0] !== '$' || path.length < 2) return null;
      if (path[1] === '$schema') return null;
      for (var i = 2; i < path.length; i++) {
        var seg = path[i];
        if (typeof seg === 'number') {
          if (schema.type !== 'array' || !schema.items) return null;
          schema = schema.items;
        } else if (Array.isArray(seg)) {
          for (var j = 0; j < seg.length; j++) {
            if (schema.type !== 'array' || !schema.items) return null;
            schema = schema.items;
          }
        } else {
          if (!schema.properties || !schema.properties[seg]) return null;
          schema = schema.properties[seg];
        }
      }
      return schema;
    }

    function colDef(schema, val) {
      var type = val != null ? typeOf(val) : 'any';

      var st = schema && schema.type;
      if (st && type === 'any') {
        if (Array.isArray(st)) st = st.filter(function (x) { return x !== 'null'; })[0] || 'null';
        var ST = { string: 'str', number: 'num', integer: 'int', boolean: 'bool', null: 'any', array: 'arr', object: 'obj' };
        type = ST[st] || 'any';
      }

      return {
        type: type,
        coldef: type === 'bool' ? { type: 'dropdown', source: ['true', 'false'], allowInvalid: false } : {}
      };
    }

    function tableColumns(schema, raw) {
      var type = typeOf(raw);

      if (type === 'obj') {
        var props = (schema && schema.properties) || {};
        var rawKeys = Object.keys(raw || {});
        var keys = rawKeys.slice();
        Object.keys(props).forEach(function (k) {
          if (keys.indexOf(k) === -1) keys.push(k);
        });
        var headers = [];
        var columns = [];
        keys.forEach(function (k) {
          var col = colDef(props[k], raw && raw[k]);
          headers.push(k + ' (' + col.type + ')');
          columns.push(col.coldef);
        });
        return { keys: keys, headers: headers, columns: columns };
      }

      if (type === 'arr' || type === 'mat') {
        var itemSchema = (schema && schema.items) || null;
        var items = raw || [];
        var nonNull = items.filter(function (it) { return it != null; });
        var allObj = nonNull.length > 0 && nonNull.every(function (it) {
          return typeof it === 'object' && !Array.isArray(it);
        });
        var schemaObj = itemSchema && (
          itemSchema.type === 'object' ||
          (itemSchema.properties && Object.keys(itemSchema.properties).length > 0)
        );

        if (allObj || schemaObj) {
          var itemProps = (itemSchema && itemSchema.properties) || {};
          var mergedKeys = Object.keys(itemProps);
          nonNull.forEach(function (it) {
            Object.keys(it).forEach(function (k) {
              if (mergedKeys.indexOf(k) === -1) mergedKeys.push(k);
            });
          });
          var headers = [];
          var columns = [];
          mergedKeys.forEach(function (k) {
            var val;
            for (var i = 0; i < items.length; i++) {
              if (items[i] && k in items[i]) { val = items[i][k]; break; }
            }
            var col = colDef(itemProps[k], val);
            headers.push(k + ' (' + col.type + ')');
            columns.push(col.coldef);
          });
          return { items: { keys: mergedKeys, headers: headers, columns: columns } };
        }

        return { items: null };
      }
    }

    // ============================================================
    // Cell Renderer
    // ============================================================
    function cellRenderer(hot, td, row, col, prop, value, cellProperties) {
      Handsontable.renderers.TextRenderer.apply(this, arguments);
      if (value == null || value === '') { td.innerHTML = ''; return; }
      var expanded = !!cellProperties._expanded;
      var display = value;
      var title = '';
      if (value.length > 100) {
        display = value.slice(0, 35) + '...';
        title = formatJSON(tryParse(value));
      }
      td.title = title;
      if (expanded) {
        td.innerHTML = '<span class="json-table-button json-table-cell-button active">[-]</span><span class="json-table-cell-text">' + esc(display) + '</span>';
      } else {
        td.innerHTML = '<span class="json-table-button json-table-cell-button">[+]</span><span class="json-table-cell-text">' + esc(display) + '</span>';
      }
    }

    // ============================================================
    // Hot
    // ============================================================
    function makeHot(div, cfg) {
      return new Handsontable(div, Object.assign({
        licenseKey: 'non-commercial-and-evaluation',
        themeName: 'ht-theme-classic',
        editor: 'text',
        renderer: cellRenderer,
        width: 'auto', height: 'auto',
        wordWrap: false,
        manualColumnResize: true,
        outsideClickDeselects: false, contextMenu: false,
      }, cfg));
    }

    function readData(hot, type, keys) {
      var data = hot.getData();
      if (type === 'obj') {
        var row = data[0] || [];
        var obj = {};
        for (var i = 0; i < keys.length; i++) {
          obj[keys[i]] = tryParse(row[i]);
        }
        return obj;
      }

      if (type === 'mat') {
        var rows = data.map(function (r) {
          var end = r.length;
          while (end > 0 && (r[end - 1] == null || r[end - 1] === '')) end--;
          return r.slice(0, end).map(function (c) { return tryParse(c); });
        });
        while (rows.length > 0 && rows[rows.length - 1].length === 0) rows.pop();
        return rows;
      }

      if (type === 'arr') {
        var rows = data.filter(function (r) {
          return r.some(function (c) { return c != null && c !== ''; });
        });
        if (keys && keys.length > 0) {
          return rows.map(function (r) {
            var o = {};
            for (var j = 0; j < keys.length; j++) {
              if (r[j] != null) o[keys[j]] = tryParse(r[j]);
            }
            return o;
          });
        }
        return rows.map(function (r) { return tryParse(r[0]); });
      }

      return tryParse(data[0] && data[0][0]);
    }

    // ============================================================
    // Slot
    // ============================================================
    function findSlot(hot) {
      for (var parent = hot.rootElement.parentNode; parent && parent !== document.body; parent = parent.parentNode) {
        if (parent.classList && parent.classList.contains('json-table-slot')) return parent;
      }
      return null;
    }

    function saveSlot(el) {
      if (el._view === 'text')  el._raw = el._textTA.value;
      if (el._view === 'raw')   el._raw = tryParse(el._rawTA.value);
      if (el._view === 'table' && el._hot) el._raw = readData(el._hot, el._type, el._keys);
    }

    function cascadeUp(el) {
      if (el._parentHot && el._parentRow >= 0 && el._parentCol >= 0) {
        el._parentHot.setDataAtCell(el._parentRow, el._parentCol, JSON.stringify(el._raw), 'cascade');
      }
    }

    function clearChildren(el) {
      var kids = el._children.querySelectorAll(':scope > .json-table-slot');
      for (var i = kids.length - 1; i >= 0; i--) {
        destroySlot(kids[i]);
      }
    }

    function destroySlot(el) {
      saveSlot(el);
      clearChildren(el);
      if (el._hot) {
        el._hot.destroy();
        el._hot = null;
      }
      if (el._parentHot && el._parentRow >= 0 && el._parentCol >= 0) {
        cascadeUp(el);
        var meta = el._parentHot.getCellMeta(el._parentRow, el._parentCol);
        meta._expanded = false;
        meta._slot = null;
        el._parentHot.render();
      }
      el.remove();
    }

    function cellPath(hot, row, col) {
      var slot = findSlot(hot);
      var base = slot._path;
      var keys = slot._keys;

      if (slot._type === 'mat') return base.concat([[row, col]]);
      if (slot._type === 'arr') {
        if (keys && keys.length > 0) return base.concat([row, keys[col]]);
        return base.concat([row]);
      }
      if (keys && keys.length > 0) return base.concat([keys[col]]);
      return base.concat([row]);
    }

    function createSlot(parent, opts) {
      var tplEl = document.getElementById('json-table-template');
      var el = tplEl.content.cloneNode(true).querySelector('.json-table-slot');
      if (opts.isRoot) el.classList.add('json-table-slot-root');

      el._path = opts.path || [];
      el.querySelector('.json-table-slot-path').textContent = pathStr(el._path);
      el._raw  = opts.raw;
      el._type = opts.type;
      el._parentRow = opts.parentRow;
      el._parentCol = opts.parentCol;
      el._parentHot = opts.parentHot;

      var head = el.querySelector('.json-table-slot-head');
      el._btnTable = head.querySelector('.json-table-button-table');
      el._btnText  = head.querySelector('.json-table-button-text');
      el._btnRaw   = head.querySelector('.json-table-button-raw');
      el._btnCollapse = head.querySelector('.json-table-button-collapse');

      el._btnTable.style.display = opts.showTable ? '' : 'none';
      el._btnText.style.display  = opts.type === 'str' ? '' : 'none';
      el._btnRaw.style.display   = '';
      el._btnCollapse.style.display = opts.noCollapse ? 'none' : '';

      el._btnTable.addEventListener('mousedown', function (e) { e.preventDefault(); switchView(el, 'table'); });
      el._btnText.addEventListener('mousedown',  function (e) { e.preventDefault(); switchView(el, 'text'); });
      el._btnRaw.addEventListener('mousedown',   function (e) { e.preventDefault(); switchView(el, 'raw'); });
      el._btnCollapse.addEventListener('mousedown', function (e) { e.preventDefault(); destroySlot(el); });

      el._hot = null;
      el._view = '';
      el._hotDiv   = el.querySelector('.json-table-slot-hot');
      el._textTA   = el.querySelector('.json-table-slot-text-text');
      el._rawTA    = el.querySelector('.json-table-slot-text-raw');
      el._children = el.querySelector('.json-table-slot-children');

      var target = parent || container;
      var kids = target.querySelectorAll(':scope > .json-table-slot');
      var inserted = false;
      for (var i = 0; i < kids.length; i++) {
        var kid = kids[i];
        if (kid._parentRow > el._parentRow || (kid._parentRow === el._parentRow && kid._parentCol > el._parentCol)) {
          target.insertBefore(el, kid);
          inserted = true;
          break;
        }
      }
      if (!inserted) target.appendChild(el);
      return el;
    }

    function switchView(el, view) {
      if (el._view === view) return;
      saveSlot(el);
      if (el._view === 'table' && el._hot) {
        clearChildren(el);
        el._hot.destroy();
        el._hot = null;
      }

      el._hotDiv.style.display = 'none';
      el._textTA.style.display = 'none';
      el._rawTA.style.display = 'none';

      if (view === 'table') {
        el._hotDiv.style.display = 'block';
        el._hot = buildHot(el);
      }
      if (view === 'text') {
        el._textTA.style.display = 'block';
        el._textTA.value = String(el._raw);
      }
      if (view === 'raw') {
        el._rawTA.style.display = 'block';
        var t = typeOf(el._raw);
        if (t === 'obj' || t === 'arr' || t === 'mat') {
          el._rawTA.value = formatJSON(el._raw);
        } else {
          el._rawTA.value = JSON.stringify(el._raw);
        }
      }

      el._view = view;
      el._btnTable.classList.toggle('active', view === 'table');
      el._btnText.classList.toggle('active', view === 'text');
      el._btnRaw.classList.toggle('active', view === 'raw');
    }

    function buildHot(el) {
      var type = el._type, path = el._path, raw = el._raw;
      var cfg, desc, itemDesc;

      if (type === 'obj') {
        desc = tableColumns(getSchema(path), raw);
        cfg = { keys: desc.keys, hot: { data: [desc.keys.map(function(k) { return JSON.stringify(k in raw ? raw[k] : null); })], colHeaders: desc.headers, columns: desc.columns } };
      } else if (type === 'mat') {
        cfg = { keys: null, hot: { data: raw.map(function(r) { return r.map(function(c) { return JSON.stringify(c); }); }), colHeaders: true, rowHeaders: true, manualRowMove: true, minSpareRows: 2, minSpareCols: 3 } };
      } else if (type === 'arr') {
        if (raw.length === 0) {
          cfg = { keys: null, hot: { data: [['']], colHeaders: true, rowHeaders: true, manualRowMove: true, minSpareRows: 2 } };
        } else {
          desc = tableColumns(getSchema(path), raw);
          itemDesc = desc.items;
          if (itemDesc) {
            cfg = { keys: itemDesc.keys, hot: { data: raw.map(function(it) { return itemDesc.keys.map(function(k) { return JSON.stringify(it && k in it ? it[k] : null); }); }), colHeaders: itemDesc.headers, rowHeaders: true, columns: itemDesc.columns, manualRowMove: true, minSpareRows: 2 } };
          } else {
            cfg = { keys: null, hot: { data: raw.map(function(it) { return [JSON.stringify(it)]; }), colHeaders: true, rowHeaders: true, manualRowMove: true, minSpareRows: 2 } };
          }
        }
      } else {
        cfg = { keys: null, hot: { data: [[JSON.stringify(raw)]] } };
      }

      el._keys = cfg.keys;
      var hot = makeHot(el._hotDiv, cfg.hot);

      hot.addHook('afterOnCellMouseDown', function (event, coords, td) {
        if (!event.target.classList.contains('json-table-cell-button')) return;
        event.stopPropagation();
        event.preventDefault();
        var meta = hot.getCellMeta(coords.row, coords.col);
        if (meta._expanded) {
          collapseCell(hot, coords.row, coords.col);
        } else {
          expandCell(hot, coords.row, coords.col);
        }
      });
      hot.addHook('beforeChange', function (changes, source) {
        if (source === 'loadData' || source === 'cascade') return;
        changes.forEach(function (ch) {
          var meta = hot.getCellMeta(ch[0], ch[1]);
          if (meta._slot) { destroySlot(meta._slot); }
        });
      });
      hot.addHook('afterChange', function (changes, source) {
        if (source === 'loadData') return;
        el._raw = readData(el._hot, el._type, el._keys);
        if (el.classList.contains('json-table-slot-root')) {
          _state.root.$schema = el._raw.$schema;
          _state.root.data = el._raw.data;
        } else {
          cascadeUp(el);
        }
      });

      if (type === 'arr' || type === 'mat') {
        hot.addHook('beforeRowMove', function () { clearChildren(el); });
        hot.addHook('afterRowMove', function () {
          el._raw = readData(el._hot, el._type, el._keys);
          cascadeUp(el);
        });
      }

      return hot;
    }

    // ============================================================
    // Cell Expand / Collapse
    // ============================================================
    function expandCell(hot, row, col) {
      var meta = hot.getCellMeta(row, col);
      var raw = tryParse(hot.getDataAtCell(row, col));
      var type = typeOf(raw);
      var hasTable = type === 'obj' || type === 'arr' || type === 'mat';
      var parentSlot = findSlot(hot);
      var parent = parentSlot ? parentSlot._children : container;

      var child = createSlot(parent, {
        path: cellPath(hot, row, col),
        raw: raw, type: type,
        parentHot: hot, parentRow: row, parentCol: col,
        showTable: hasTable, noCollapse: false
      });

      meta._expanded = true;
      meta._slot = child;
      hot.render();

      if (hasTable) switchView(child, 'table');
      else if (type === 'str') switchView(child, 'text');
      else switchView(child, 'raw');
    }

    function collapseCell(hot, row, col) {
      var meta = hot.getCellMeta(row, col);
      if (!meta._slot) return;
      destroySlot(meta._slot);
    }

    // ============================================================
    // Init
    // ============================================================
    _state.root = { $schema: schema || null, data: data };

    var root = createSlot(null, {
      isRoot: true, path: ['$'],
      raw: _state.root, type: 'obj',
      showTable: true, noCollapse: true
    });
    switchView(root, 'table');

    // ============================================================
    // Public API
    // ============================================================
    this.getData = function () {
      return _state.root.data;
    };

    this.getSchema = function () {
      return _state.root.$schema;
    };

    this.destroy = function () {
      destroySlot(root);
      var tplEl = document.getElementById('json-table-template');
      if (tplEl) tplEl.remove();
    };
  }

  // ============================================================
  // Export
  // ============================================================
  window.JsonTable = JsonTable;

})();
