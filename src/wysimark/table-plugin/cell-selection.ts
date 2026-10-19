import { Editor, Element, Node, Path, PathRef, Range, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { clearBlockSelection, isWholeBlockSelected } from '../../blocks/selection'
import { blockDepth, indentSelectedBlocks, isEditorSpacer } from '../../blocks/model'
import { selectStructuredBoundary } from '../../blocks/boundary'
import type { TableElement } from './types'
import { clipboardFragmentHtml } from '../paste-markdown-plugin/clipboard-html'

export type TableCellSelection = {
  table: TableElement; path: Path; left: number; right: number; top: number; bottom: number
  axis?: 'row' | 'column'
  kind?: 'cell'
  anchorCell?: { x: number; y: number }
  focusCell?: { x: number; y: number }
}

const editingCells = new WeakMap<Editor, PathRef>()
const compositionEdits = new WeakMap<Editor, {path:Path;awaitingDelete:boolean;batch?:object}>()
const controlledSelections = new WeakSet<Editor>()
const cellNavigationKeys = new Set(['Tab','Escape','Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'])
function withoutAutomaticCellSelection<T>(editor: Editor, run: () => T): T {
  const nested=controlledSelections.has(editor);controlledSelections.add(editor)
  try{return run()}finally{if(!nested)controlledSelections.delete(editor)}
}
function clearEditingCell(editor: Editor): void { editingCells.get(editor)?.unref(); editingCells.delete(editor); compositionEdits.delete(editor) }
function trackEditingCell(editor: Editor, path: Path): void {
  clearEditingCell(editor); editingCells.set(editor, Editor.pathRef(editor, path))
}
export function isTableCellEditing(editor: Editor, path: Path): boolean {
  const current = editingCells.get(editor)?.current
  return !!current && Path.equals(current, path)
}

export function selectTableCell(editor: Editor, cellPath: Path): void {
  clearEditingCell(editor); clearBlockSelection(editor)
  const path = cellPath.slice(0, -2), table = Node.get(editor, path) as TableElement
  const x = cellPath[cellPath.length - 1], y = cellPath[cellPath.length - 2]
  const range = Editor.range(editor, cellPath)
  withoutAutomaticCellSelection(editor,()=>Transforms.select(editor, range))
  axisSelections.set(editor, { cells: { table, path, left:x, right:x, top:y, bottom:y, kind:'cell', anchorCell:{x,y}, focusCell:{x,y} }, range })
  notifyAxis(editor)
}

export function beginTableCellEdit(editor: Editor, cellPath?: Path): boolean {
  const selected = tableCellSelection(editor)
  const path = cellPath ?? (selected?.kind === 'cell' ? [...selected.path, selected.top, selected.left] : undefined)
  if (!path || editor.wysimark.readOnly) return false
  clearTableAxisSelection(editor); clearBlockSelection(editor)
  withoutAutomaticCellSelection(editor,()=>Transforms.select(editor, Editor.end(editor, path))); trackEditingCell(editor, path)
  return true
}

/** Leave the full text range intact so Slate can replace it through native IME. */
export function prepareTableCellComposition(editor: Editor): void {
  const selected = tableCellSelection(editor)
  if (selected?.kind !== 'cell') return
  clearTableAxisSelection(editor)
  const path=[...selected.path, selected.top, selected.left]
  trackEditingCell(editor, path)
  compositionEdits.set(editor,{path,awaitingDelete:!!editor.selection&&Range.isExpanded(editor.selection)})
}

function leaveSelectedTable(editor: Editor, selected: TableCellSelection, key: string): boolean {
  clearTableAxisSelection(editor); clearEditingCell(editor); clearBlockSelection(editor)
  if(key==='ArrowRight'&&selected.path.length===1)return selectStructuredBoundary(editor,selected.path[0])
  const backwards=key==='ArrowLeft'||key==='ArrowUp',parent=Node.parent(editor,selected.path)
  let index=selected.path[selected.path.length-1]+(backwards?-1:1)
  while(index>=0&&index<parent.children.length&&isEditorSpacer(parent.children[index]))index+=backwards?-1:1
  const path=[...selected.path.slice(0,-1),index]
  if(index>=0&&index<parent.children.length){Transforms.select(editor,backwards?Editor.end(editor,path):Editor.start(editor,path));return true}
  // A table at the document edge still needs an editable destination.
  const at=[...selected.path.slice(0,-1),backwards?0:parent.children.length]
  const insert=()=>Editor.withoutNormalizing(editor,()=>{
    Transforms.insertNodes(editor,{type:'paragraph',__blockDepth:blockDepth(selected.table),children:[{text:''}]},{at})
    Transforms.select(editor,Editor.start(editor,at));editor.marks=null
  })
  if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,insert);else insert()
  return true
}

export function handleTableCellKey(editor: Editor, event: {key:string;shiftKey?:boolean;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean;nativeEvent?:{isComposing?:boolean}}): boolean {
  if (!cellNavigationKeys.has(event.key) || editor.wysimark.readOnly || !editor.selection || event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent?.isComposing) return false
  const selected = tableCellSelection(editor)
  const cell = Editor.above(editor, { at:editor.selection.focus, match:n=>Element.isElement(n)&&n.type==='table-cell' })
  if (!cell || isWholeBlockSelected(editor, editor.selection.anchor.path[0])) return false
  if (event.key === 'Tab') {
    if (selected && (selected.left !== selected.right || selected.top !== selected.bottom)) return indentSelectedBlocks(editor,event.shiftKey?-1:1)
    const path = cell[1], tablePath=path.slice(0,-2), table=Node.get(editor,tablePath) as TableElement
    const index=path[path.length-2]*table.columns.length+path[path.length-1]+(event.shiftKey?-1:1)
    if(index<0)return true
    if(index>=table.children.length*table.columns.length){editor.tablePlugin.tabForward();return true}
    const next=[...tablePath,Math.floor(index/table.columns.length),index%table.columns.length]
    if(selected?.kind==='cell')selectTableCell(editor,next);else beginTableCellEdit(editor,next)
    return true
  }
  if (event.key === 'Escape' && isTableCellEditing(editor,cell[1])) { selectTableCell(editor,cell[1]); return true }
  const delta=({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]} as Record<string,number[]>)[event.key]
  if (selected && event.shiftKey && delta) {
    const anchorPath=Editor.above(editor,{at:editor.selection.anchor,match:n=>Element.isElement(n)&&n.type==='table-cell'})?.[1]
    const anchor=selected.anchorCell ?? {x:anchorPath?.at(-1)??selected.left,y:anchorPath?.at(-2)??selected.top}
    const focus=selected.focusCell ?? {x:cell[1].at(-1)!,y:cell[1].at(-2)!}
    const next={x:Math.max(0,Math.min(selected.table.columns.length-1,focus.x+delta[0])),
      y:Math.max(0,Math.min(selected.table.children.length-1,focus.y+delta[1]))}
    const cells:TableCellSelection={table:selected.table,path:selected.path,kind:'cell',anchorCell:anchor,focusCell:next,
      left:Math.min(anchor.x,next.x),right:Math.max(anchor.x,next.x),top:Math.min(anchor.y,next.y),bottom:Math.max(anchor.y,next.y)}
    const range={anchor:Editor.start(editor,[...cells.path,cells.top,cells.left]),focus:Editor.end(editor,[...cells.path,cells.bottom,cells.right])}
    clearEditingCell(editor);clearBlockSelection(editor)
    withoutAutomaticCellSelection(editor,()=>Transforms.select(editor,range))
    axisSelections.set(editor,{cells,range});notifyAxis(editor)
    return true
  }
  if (selected?.kind !== 'cell' || event.shiftKey) return false
  if (event.key === 'Enter' || event.key === ' ') return beginTableCellEdit(editor)
  if(!delta)return false
  const x=selected.left+delta[0],y=selected.top+delta[1]
  if(x<0||x>=selected.table.columns.length||y<0||y>=selected.table.children.length)return leaveSelectedTable(editor,selected,event.key)
  selectTableCell(editor,[...selected.path,y,x]);return true
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
  clearEditingCell(editor)
  const path = Path.parent(Path.parent(cellPath)), table = Node.get(editor, path) as TableElement
  const y = cellPath[cellPath.length - 2], x = cellPath[cellPath.length - 1]
  const cells: TableCellSelection = { table, path, axis,
    left: axis === 'row' ? 0 : x, right: axis === 'row' ? table.columns.length - 1 : x,
    top: axis === 'column' ? 0 : y, bottom: axis === 'column' ? table.children.length - 1 : y }
  const range = { anchor: Editor.start(editor, [...path, cells.top, cells.left]),
    focus: Editor.end(editor, [...path, cells.bottom, cells.right]) }
  withoutAutomaticCellSelection(editor,()=>Transforms.select(editor, range))
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
  const replace = () => withoutAutomaticCellSelection(editor,()=>Editor.withoutNormalizing(editor, () => {
    for (let y = selected.bottom; y >= selected.top; y--) for (let x = selected.right; x >= selected.left; x--) {
      const range = Editor.range(editor, [...selected.path, y, x])
      // Deleting a collapsed empty-cell range performs a character deletion
      // across its boundary. An empty cell already has no content to clear.
      if (Range.isExpanded(range)) Transforms.delete(editor, { at: range })
    }
    Transforms.select(editor, Editor.start(editor, [...selected.path, selected.top, selected.left]))
    if (selected.kind === 'cell' && insert) trackEditingCell(editor, [...selected.path, selected.top, selected.left])
    insert?.()
  }))
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, replace)
  else replace()
  if (selected.kind === 'cell' && !insert) selectTableCell(editor,[...selected.path,selected.top,selected.left])
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
  const {insertText,deleteFragment}=editor
  editor.deleteFragment=options=>{
    const composition=compositionEdits.get(editor)
    if(!composition?.awaitingDelete)return deleteFragment(options)
    composition.awaitingDelete=false
    if(HistoryEditor.isHistoryEditor(editor)) {
      HistoryEditor.withNewBatch(editor,()=>deleteFragment(options))
      composition.batch=editor.history.undos.at(-1)
    } else deleteFragment(options)
  }
  editor.insertText=text=>{
    const composition=compositionEdits.get(editor)
    compositionEdits.delete(editor)
    if(composition?.batch&&editor.selection&&Path.isAncestor(composition.path,editor.selection.anchor.path)&&
      HistoryEditor.isHistoryEditor(editor)&&editor.history.undos.at(-1)===composition.batch)HistoryEditor.withMerging(editor,()=>insertText(text))
    else insertText(text)
  }
  const apply = editor.apply
  editor.apply = operation => {
    const previousSelection = editor.selection
    const axis = axisSelections.get(editor)
    const preserve = axis && operation.type === 'set_node' && (Path.equals(operation.path, axis.cells.path) ||
      (axis.cells.kind === 'cell' && Path.isAncestor([...axis.cells.path,axis.cells.top,axis.cells.left],operation.path)))
    if (!preserve && (operation.type !== 'set_selection' || !editor.selection || !operation.newProperties ||
      !Range.equals(editor.selection, { ...editor.selection, ...operation.newProperties }))) clearTableAxisSelection(editor)
    apply(operation)
    const editing = editingCells.get(editor)?.current, selection = editor.selection
    if (editingCells.has(editor) && (!editing || !selection || !Path.isAncestor(editing,selection.anchor.path) || !Path.isAncestor(editing,selection.focus.path))) clearEditingCell(editor)
    if (preserve) {
      axisSelections.set(editor, { ...axis, cells: { ...axis.cells, table: Node.get(editor, axis.cells.path) as TableElement } })
      notifyAxis(editor)
    }
    if (operation.type === 'set_selection' && !editor.wysimark.readOnly && !controlledSelections.has(editor) &&
      selection && Range.isCollapsed(selection) && !isWholeBlockSelected(editor,selection.anchor.path[0])) {
      const cell=Editor.above(editor,{at:selection.anchor,match:n=>Element.isElement(n)&&n.type==='table-cell'})
      if(cell && (!previousSelection || !Path.isAncestor(cell[1],previousSelection.anchor.path) || !Path.isAncestor(cell[1],previousSelection.focus.path)))selectTableCell(editor,cell[1])
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
