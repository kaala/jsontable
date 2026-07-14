# JSON Table Editor

A pure frontend, single-file JSON visual editor that edits nested JSON data as spreadsheets.

## Quick Start

Open `index.html` in a browser. No install, no build, no dependencies.

## Features

- **Spreadsheet editing**: objects become single-row multi-column tables, arrays become multi-row tables, arrays-of-objects auto-merge keys into multi-column tables, matrices become multi-row multi-column freeform grids
- **Three views**: TABLE / TEXT / RAW, switchable per slot via buttons, independent DOM per view
- **Infinite nesting**: `[+]` expands a cell into a child slot, `[-]` collapses, changes cascade upward
- **Pure JSON text**: all cell values are JSON text strings (display = value), copy/paste passes through directly
- **JSON Schema**: optional `$schema` column defines type constraints, auto-derived type annotations and dropdowns
- **Array operations**: row drag-to-reorder, auto-spare rows/columns
- **Zero-dependency**: only CDN-loaded Handsontable 14.6

## Tech Stack

| Item | Detail |
|------|--------|
| Framework | None, vanilla JavaScript |
| Table | Handsontable 14.6 (jsDelivr CDN) |
| Font | monospace 13px |
| Code | 23 functions, 535 lines, 5 sections |

## Files

| File | Description |
|------|-------------|
| `index.html` | Main program |
| `SPEC.md` | Specification |
| `PLAN.md` | Implementation outline |
