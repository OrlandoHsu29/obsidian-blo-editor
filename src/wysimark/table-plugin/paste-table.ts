import { Editor, Element, Node, Path, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import type { TableElement, TableCellElement } from './types'
import { clearTableAxisSelection, selectTableCellRange, tableCellSelection } from './cell-selection'
import { isWholeBlockSelected } from '../../blocks/selection'
import { isEditorSpacer } from '../../blocks/model'
import { cleanPastedFragment } from '../../blocks/typography'
import { createCell } from './methods/utils'

/** Paste a table as a cell grid, never as a nested table inside one cell. */
export function pasteTableFragment(editor: Editor, fragment: Node[]): boolean {
  if (editor.wysimark.readOnly || !editor.selection || isWholeBlockSelected(editor, editor.selection.anchor.path[0])) return false
  const meaningful = fragment.filter(node => !isEditorSpacer(node) && !(Element.isElement(node) && node.type === 'paragraph' && Editor.isEmpty(editor, node)))
  if (meaningful.length !== 1 || !Element.isElement(meaningful[0]) || meaningful[0].type !== 'table') return false
  const source = meaningful[0]
  if (!source.children.length || !source.columns.length) return false
  const selected = tableCellSelection(editor)
  const cellAt = (point: typeof editor.selection.anchor) => Editor.above(editor, { at: point, match: node => Element.isElement(node) && node.type === 'table-cell' })
  const anchor = cellAt(editor.selection.anchor), focus = cellAt(editor.selection.focus)
  if (!anchor || !focus || !Path.equals(anchor[1].slice(0, -2), focus[1].slice(0, -2))) return false
  const path = selected?.path ?? anchor[1].slice(0, -2)
  const table = Node.get(editor, path)
  if (!Element.isElement(table) || table.type !== 'table') return false
  const left = selected?.left ?? anchor[1][anchor[1].length - 1]
  const top = selected?.top ?? anchor[1][anchor[1].length - 2]
  const width = Math.max(source.columns.length, ...source.children.map(row => row.children.length))
  const height = source.children.length
  const columns = Math.max(table.columns.length, left + width), rows = Math.max(table.children.length, top + height)
  // Snapshot cell content first, including same-table copy/paste with overlap.
  const contents = source.children.map(row => Array.from({ length: width }, (_, x) => {
    const cell = row.children[x]
    const children = cell?.children.flatMap((content, index) => [
      ...(index ? [{ text: '\n' }] : []), ...cleanPastedFragment(content.children),
    ]) ?? [{ text: '' }]
    return { type: 'table-content' as const, children: children.length ? children : [{ text: '' }] }
  }))
  const paste = () => {
    Editor.withoutNormalizing(editor, () => {
      clearTableAxisSelection(editor)
      if (columns > table.columns.length) {
        const added = Array.from({ length: columns - table.columns.length }, (_, i) =>
          ({ align: source.columns[table.columns.length + i - left]?.align ?? table.columns.at(-1)?.align ?? 'left' as const }))
        Transforms.setNodes(editor, { columns: [...table.columns, ...added] }, { at: path })
        for (let y = 0; y < table.children.length; y++) {
          Transforms.insertNodes(editor, Array.from({ length: columns - table.columns.length }, () => createCell()), { at: [...path, y, table.columns.length] })
        }
      }
      if (rows > table.children.length) {
        Transforms.insertNodes(editor, Array.from({ length: rows - table.children.length }, () => ({
          type: 'table-row' as const, children: Array.from({ length: columns }, () => createCell()),
        })), { at: [...path, table.children.length] })
      }
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const at = [...path, top + y, left + x]
        const cell = Node.get(editor, at) as TableCellElement
        for (let i = cell.children.length - 1; i >= 0; i--) Transforms.removeNodes(editor, { at: [...at, i] })
        Transforms.insertNodes(editor, contents[y][x], { at: [...at, 0] })
      }
    })
    selectTableCellRange(editor, path, { x: left, y: top }, { x: left + width - 1, y: top + height - 1 })
  }
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, paste)
  else paste()
  return true
}

/** Spreadsheet plain text uses tab-separated cells, with quoted multiline values. */
export function clipboardTextTable(text: string): TableElement | undefined {
  if (!text.includes('\t')) return
  const source = text.replace(/\r\n?/g, '\n'), grid: string[][] = [[]]
  let value = '', quoted = false, separated = false
  const cell = () => { grid[grid.length - 1].push(value); value = '' }
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { value += '"'; i++ }
      else if (char === '"') quoted = false
      else value += char
    } else if (char === '"' && !value) quoted = true
    else if (char === '\t') { separated = true; cell() }
    else if (char === '\n') { cell(); grid.push([]) }
    else value += char
  }
  if (quoted || !separated) return
  cell()
  if (source.endsWith('\n')) grid.pop()
  const width = Math.max(...grid.map(row => row.length))
  return {
    type: 'table', headerRow: false, headerColumn: false,
    columns: Array.from({ length: width }, () => ({ align: 'left' })),
    children: grid.map(row => ({ type: 'table-row', children: Array.from({ length: width }, (_, x) => ({
      type: 'table-cell', children: [{ type: 'table-content', children: [{ text: row[x] ?? '' }] }],
    })) })),
  }
}
