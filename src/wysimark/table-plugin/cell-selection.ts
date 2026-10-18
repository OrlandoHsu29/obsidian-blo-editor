import { Editor, Element, Node, Path, Range, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { isWholeBlockSelected } from '../../blocks/selection'
import type { TableElement } from './types'
import { clipboardFragmentHtml } from '../paste-markdown-plugin/clipboard-html'

export type TableCellSelection = {
  table: TableElement; path: Path; left: number; right: number; top: number; bottom: number
  axis?: 'row' | 'column'
}

const axisSelections = new WeakMap<Editor, { cells: TableCellSelection; range: Range }>()
const axisListeners = new WeakMap<Editor, Set<() => void>>()
const notifyAxis = (editor: Editor) => axisListeners.get(editor)?.forEach(listener => listener())
export const getTableAxisSelection = (editor: Editor) => axisSelections.get(editor)
export function subscribeTableAxisSelection(editor: Editor, listener: () => void): () => void {
  let listeners = axisListeners.get(editor)
  if (!listeners) axisListeners.set(editor, listeners = new Set())
  listeners.add(listener)
  return () => { listeners!.delete(listener) }
}

export function clearTableAxisSelection(editor: Editor): void {
  if (axisSelections.delete(editor)) notifyAxis(editor)
}

export function selectTableAxis(editor: Editor, cellPath: Path, axis: 'row' | 'column'): void {
  const path = Path.parent(Path.parent(cellPath)), table = Node.get(editor, path) as TableElement
  const y = cellPath[cellPath.length - 2], x = cellPath[cellPath.length - 1]
  const cells: TableCellSelection = { table, path, axis,
    left: axis === 'row' ? 0 : x, right: axis === 'row' ? table.columns.length - 1 : x,
    top: axis === 'column' ? 0 : y, bottom: axis === 'column' ? table.children.length - 1 : y }
  const range = { anchor: Editor.start(editor, [...path, cells.top, cells.left]),
    focus: Editor.end(editor, [...path, cells.bottom, cells.right]) }
  Transforms.select(editor, range)
  axisSelections.set(editor, { cells, range })
  notifyAxis(editor)
}

export function deleteSelectedTableAxis(editor: Editor): boolean {
  if (editor.wysimark.readOnly) return false
  const cells = tableCellSelection(editor)
  if (!cells?.axis) return false
  clearTableAxisSelection(editor)
  const remove = () => {
    Transforms.select(editor, Editor.start(editor, [...cells.path, cells.top, cells.left]))
    if (cells.axis === 'row') editor.tablePlugin.removeRow()
    else editor.tablePlugin.removeColumn()
  }
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, remove)
  else remove()
  return true
}

/** A multi-cell selection is a rectangle, rather than a row-major text range. */
export function tableCellSelection(editor: Editor): TableCellSelection | undefined {
  const selection = editor.selection
  const axis = axisSelections.get(editor)
  if (axis && selection && Range.equals(selection, axis.range) && Node.has(editor, axis.cells.path) && Node.get(editor, axis.cells.path) === axis.cells.table) return axis.cells
  if (!selection || Range.isCollapsed(selection) || isWholeBlockSelected(editor, selection.anchor.path[0])) return
  const cell = (at: typeof selection.anchor) => Editor.above(editor, {
    at, match: node => Element.isElement(node) && node.type === 'table-cell',
  })
  const anchor = cell(selection.anchor), focus = cell(selection.focus)
  if (!anchor || !focus || Path.equals(anchor[1], focus[1])) return
  const path = Path.parent(Path.parent(anchor[1]))
  if (!Path.equals(path, Path.parent(Path.parent(focus[1])))) return
  const table = Node.get(editor, path)
  if (!Element.isElement(table) || table.type !== 'table') return
  const x = (path: Path) => path[path.length - 1], y = (path: Path) => path[path.length - 2]
  return { table, path, left: Math.min(x(anchor[1]), x(focus[1])), right: Math.max(x(anchor[1]), x(focus[1])),
    top: Math.min(y(anchor[1]), y(focus[1])), bottom: Math.max(y(anchor[1]), y(focus[1])) }
}

export function replaceSelectedCells(editor: Editor, insert?: () => void): boolean {
  if (editor.wysimark.readOnly) return false
  const selected = tableCellSelection(editor)
  if (!selected) return false
  clearTableAxisSelection(editor)
  const replace = () => Editor.withoutNormalizing(editor, () => {
    for (let y = selected.bottom; y >= selected.top; y--) for (let x = selected.right; x >= selected.left; x--) {
      Transforms.delete(editor, { at: Editor.range(editor, [...selected.path, y, x]) })
    }
    Transforms.select(editor, Editor.start(editor, [...selected.path, selected.top, selected.left]))
    insert?.()
  })
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, replace)
  else replace()
  return true
}

function selectedFragment(selected: TableCellSelection): TableElement {
  return { ...selected.table, headerRow: selected.top === 0 && selected.table.headerRow !== false,
    headerColumn: selected.left === 0 && !!selected.table.headerColumn,
    columns: selected.table.columns.slice(selected.left, selected.right + 1),
    children: selected.table.children.slice(selected.top, selected.bottom + 1).map((row, y) => ({
      ...row, children: row.children.slice(selected.left, selected.right + 1).map((cell, x) => ({ ...cell, x, y })),
    })) }
}

/** Keep rich, HTML and plain-text clipboard formats confined to the same cells. */
export function installTableCellClipboard(editor: Editor): void {
  const apply = editor.apply
  editor.apply = operation => {
    const axis = axisSelections.get(editor)
    const preserve = axis && operation.type === 'set_node' && Path.equals(operation.path, axis.cells.path)
    if (!preserve && (operation.type !== 'set_selection' || !editor.selection || !operation.newProperties ||
      !Range.equals(editor.selection, { ...editor.selection, ...operation.newProperties }))) clearTableAxisSelection(editor)
    apply(operation)
    if (preserve) {
      axisSelections.set(editor, { ...axis, cells: { ...axis.cells, table: Node.get(editor, axis.cells.path) as TableElement } })
      notifyAxis(editor)
    }
  }
  const { getFragment, setFragmentData } = editor
  editor.getFragment = () => {
    const selected = tableCellSelection(editor)
    return selected ? [selectedFragment(selected)] : getFragment()
  }
  editor.setFragmentData = (data, origin) => {
    const selected = tableCellSelection(editor)
    if (!selected) return setFragmentData(data, origin)
    const fragment = selectedFragment(selected)
    const encoded = window.btoa(encodeURIComponent(JSON.stringify([fragment])))
    data.setData('application/x-slate-fragment', encoded)
    data.setData('text/html', clipboardFragmentHtml([fragment], encoded))
    data.setData('text/plain', fragment.children.map(row => row.children.map(cell => Node.string(cell)).join('\t')).join('\n'))
  }
}
