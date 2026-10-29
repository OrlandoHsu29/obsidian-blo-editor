import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor, Element, Path, Range, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { ui } from '../../utils/translations'
import { isDomElement } from '../../../dom-guards'
import { beginTableCellEdit, clearTableAxisSelection, isTableCellEditing, prepareTableCellComposition, selectTableCell, tableCellSelection } from '../cell-selection'
import type { TableColumnAlign, TableElement } from '../types'
import { useBlockToolbarPosition } from '../../use-reposition/hooks/use-block-toolbar-position'
import { editorOverlayViewport } from '../../use-reposition/observe-anchored-overlay'

type Position = { left: number; top: number }
type Insertion = Position & { axis: 'row' | 'column'; index: number }

/** Single clicks select cells; explicit editing restores native text selection. */
export function TableInteractions({ element, readOnly, active }: { element: TableElement; readOnly: boolean; active: boolean }) {
  const editor = useSlateStatic()
  const [tableAnchor, setTableAnchor] = useState<HTMLTableElement | null>(null)
  const [insertions, setInsertions] = useState<Insertion[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
  const insertRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    setTableAnchor(active && !readOnly ? ReactEditor.toDOMNode(editor, element) as HTMLTableElement : null)
  }, [active, editor, element, readOnly])
  // Leave room for the column handles and their delete action above the table.
  const menu = useBlockToolbarPosition(tableAnchor, menuRef, { active: active && !readOnly, alignment: 'center', aboveGap: 62 })

  useEffect(() => {
    if (readOnly) return
    const table = ReactEditor.toDOMNode(editor, element) as HTMLTableElement
    const doc = table.ownerDocument, win = doc.defaultView!
    let origin: Path | undefined, snapped: Range | undefined
    let hoverTimer: number | undefined, leaveTimer: number | undefined
    let pending: Insertion[] | undefined
    let repairing = false
    const cancelHover = () => { win.clearTimeout(hoverTimer); hoverTimer = undefined; pending = undefined }
    const hideInsertions = () => {
      cancelHover(); win.clearTimeout(leaveTimer); leaveTimer = undefined
      setInsertions(previous => previous.length ? [] : previous)
    }
    hideInsertions()
    const cellAt = (target: EventTarget | null) => {
      if (!isDomElement(target)) return
      const cell = (target as HTMLElement).closest('td')
      if (!cell || cell.closest('table') !== table) return
      const node = ReactEditor.toSlateNode(editor, cell)
      return Element.isElement(node) && node.type === 'table-cell' ? ReactEditor.findPath(editor, node) : undefined
    }
    const synchronize = () => {
      if (!snapped || repairing) return
      repairing = true
      try {
        if (!editor.selection || !Range.equals(editor.selection, snapped)) Transforms.select(editor, snapped)
        const domRange = ReactEditor.toDOMRange(editor, snapped), selection = win.getSelection()
        if (selection && (selection.anchorNode !== domRange.startContainer || selection.anchorOffset !== domRange.startOffset ||
          selection.focusNode !== domRange.endContainer || selection.focusOffset !== domRange.endOffset)) {
          selection.setBaseAndExtent(domRange.startContainer, domRange.startOffset, domRange.endContainer, domRange.endOffset)
        }
      } finally { repairing = false }
    }
    const down = (event: MouseEvent) => {
      if (event.button !== 0 || menuRef.current?.contains(event.target as globalThis.Node) || insertRef.current?.contains(event.target as globalThis.Node)) return
      hideInsertions()
      origin = undefined; snapped = undefined
      const target = event.target as HTMLElement
      if (target.closest('[contenteditable="false"],button')) return
      if (table.contains(target)) {
        clearTableAxisSelection(editor)
        origin = cellAt(target)
        if (!origin) return
        if (event.detail >= 2) {
          event.preventDefault()
          beginTableCellEdit(editor,origin); ReactEditor.focus(editor)
          origin = undefined
        } else if (!isTableCellEditing(editor,origin)) {
          event.preventDefault()
          selectTableCell(editor,origin)
          snapped = Editor.range(editor,origin)
          ReactEditor.focus(editor)
        }
      }
    }
    const click = (event: MouseEvent) => {
      const target=event.target as HTMLElement
      if(target.closest('[contenteditable="false"],button'))return
      const cell=cellAt(target)
      if(!cell)return
      if(event.detail>=2) {
        event.preventDefault();event.stopPropagation()
      } else if(tableCellSelection(editor)?.kind==='cell') {
        event.preventDefault();event.stopPropagation()
      }
    }
    // Chromium dispatches compositionstart on the editable root, not the td.
    const composition = () => { if(tableCellSelection(editor)?.table===element)prepareTableCellComposition(editor) }
    const hover = (event: MouseEvent) => {
      if (event.buttons || !table.contains(event.target as globalThis.Node)) return
      const handle=event.target instanceof globalThis.Element?event.target.closest<HTMLElement>('[data-table-axis]'):null
      const axis=handle?.getAttribute('data-table-axis')
      if(!handle||(axis!=='row'&&axis!=='column')){hideInsertions();return}
      win.clearTimeout(leaveTimer); leaveTimer = undefined
      const rect = table.getBoundingClientRect()
      const target = handle.closest('td') as HTMLTableCellElement | null
      if (!target || target.closest('table') !== table) return
      const cell = target.getBoundingClientRect(), row = target.parentElement as HTMLTableRowElement
      const button=handle.getBoundingClientRect()
      const viewport=editorOverlayViewport(handle)
      if(button.bottom<=viewport.top||button.top>=viewport.bottom||button.right<=viewport.left||button.left>=viewport.right){hideInsertions();return}
      const right = event.clientX >= button.left + button.width / 2
      const below = event.clientY >= button.top + button.height / 2
      const next: Insertion[] = []
      if (axis === 'column') next.push({ axis: 'column', index: target.cellIndex + (right ? 1 : 0),
        left: (right ? cell.right : cell.left) - 14, top: rect.top - 54 })
      else next.push({ axis: 'row', index: row.sectionRowIndex + (below ? 1 : 0),
        left: rect.left - 54, top: (below ? cell.bottom : cell.top) - 14 })
      for (const button of next) {
        button.left = Math.max(viewport.left + 4, Math.min(viewport.right - 32, button.left))
        button.top = Math.max(viewport.top + 4, Math.min(viewport.bottom - 32, button.top))
      }
      if (pending?.length === next.length && pending.every((button, i) =>
        button.axis === next[i].axis && button.index === next[i].index && button.left === next[i].left && button.top === next[i].top)) return
      cancelHover()
      pending = next
      setInsertions(previous => previous.length ? [] : previous)
      hoverTimer = win.setTimeout(() => { hoverTimer = undefined; setInsertions(next) }, 220)
    }
    const move = (event: MouseEvent) => {
      if (!origin || !(event.buttons & 1)) {
        if (insertRef.current?.contains(event.target as globalThis.Node)) {
          win.clearTimeout(leaveTimer); leaveTimer = undefined
        } else if (!table.contains(event.target as globalThis.Node)) {
          cancelHover()
          if (leaveTimer === undefined) leaveTimer = win.setTimeout(hideInsertions, 180)
        }
        return
      }
      const cell = cellAt(event.target)
      if (!cell) return
      if (!Path.equals(cell, origin) || snapped) {
        const path = Path.parent(Path.parent(origin))
        const top = Math.min(origin[origin.length - 2], cell[cell.length - 2])
        const bottom = Math.max(origin[origin.length - 2], cell[cell.length - 2])
        const left = Math.min(origin[origin.length - 1], cell[cell.length - 1])
        const right = Math.max(origin[origin.length - 1], cell[cell.length - 1])
        snapped = { anchor: Editor.start(editor, [...path, top, left]), focus: Editor.end(editor, [...path, bottom, right]) }
        event.preventDefault()
        if(Path.equals(cell,origin))selectTableCell(editor,cell)
        synchronize()
      }
    }
    const up = () => {
      if (!origin) return
      synchronize()
      origin = undefined; snapped = undefined
    }
    const dismiss = hideInsertions
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss() }
    table.addEventListener('mousemove', hover)
    table.addEventListener('click',click,true)
    doc.addEventListener('compositionstart',composition,true)
    doc.addEventListener('mousedown', down, true)
    doc.addEventListener('mousemove', move, true)
    doc.addEventListener('mouseup', up)
    doc.addEventListener('selectionchange', synchronize)
    doc.addEventListener('keydown', key, true)
    doc.addEventListener('scroll', dismiss, true)
    win.addEventListener('resize', dismiss)
    return () => {
      win.clearTimeout(hoverTimer); win.clearTimeout(leaveTimer)
      table.removeEventListener('mousemove', hover)
      table.removeEventListener('click',click,true)
      doc.removeEventListener('compositionstart',composition,true)
      doc.removeEventListener('mousedown', down, true)
      doc.removeEventListener('mousemove', move, true)
      doc.removeEventListener('mouseup', up)
      doc.removeEventListener('selectionchange', synchronize)
      doc.removeEventListener('keydown', key, true)
      doc.removeEventListener('scroll', dismiss, true)
      win.removeEventListener('resize', dismiss)
    }
  }, [editor, element, readOnly])

  const selectionInTable=(path:Path)=>editor.selection&&Path.isAncestor(path,editor.selection.anchor.path)&&Path.isAncestor(path,editor.selection.focus.path)
  const focusTable=(path:Path)=>{
    if(!selectionInTable(path))Transforms.select(editor,Editor.start(editor,path))
    ReactEditor.focus(editor)
  }
  const align = (align: TableColumnAlign) => {
    const path = ReactEditor.findPath(editor, element), selection = editor.selection
    const inside=selectionInTable(path)
    const cells = inside?tableCellSelection(editor):undefined
    const anchor = inside&&selection?selection.anchor.path[path.length+1]:0
    const focus = inside&&selection?selection.focus.path[path.length+1]:element.columns.length-1
    const left = cells?.left ?? Math.min(anchor, focus), right = cells?.right ?? Math.max(anchor, focus)
    const columns = element.columns.map((column, x) => x >= left && x <= right ? { align } : column)
    HistoryEditor.withNewBatch(editor, () => Transforms.setNodes(editor, { columns }, { at: path }))
    focusTable(path)
  }
  const insert = (insertion: Insertion) => {
    const path = ReactEditor.findPath(editor, element)
    const count = insertion.axis === 'row' ? element.children.length : element.columns.length
    const index = Math.min(insertion.index, count - 1), offset = insertion.index === count ? 1 : 0
    const at = [...path, insertion.axis === 'row' ? index : 0, insertion.axis === 'column' ? index : 0]
    HistoryEditor.withNewBatch(editor, () => {
      if (insertion.axis === 'row') editor.tablePlugin.insertRow({ at, offset })
      else editor.tablePlugin.insertColumn({ at, offset })
    })
    setInsertions([]); ReactEditor.focus(editor)
  }
  if (readOnly) return null
  // Menus belong to the table's window, which may be a popout window.
  const hostDocument = () => {
    try { return (ReactEditor.toDOMNode(editor, element) as HTMLElement).ownerDocument } catch { return document }
  }
  return <>
    {active && tableAnchor && createPortal(<div ref={menuRef} className="wysimark-overlay wysimark-block-toolbar wysimark-table-actions" data-table-align-menu contentEditable={false}
      style={{ position: 'fixed', left: menu.left, top: menu.top, maxWidth: menu.maxWidth, visibility: menu.visible ? 'visible' : 'hidden', pointerEvents: menu.visible ? 'auto' : 'none' }}>
      {(['left', 'center', 'right'] as const).map(value => <button key={value} aria-label={ui(value === 'left' ? '列左对齐' : value === 'center' ? '列居中对齐' : '列右对齐')}
        onMouseDown={event => { event.preventDefault(); event.stopPropagation(); align(value) }}>
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          {[5, 10, 15, 20].map((y, i) => <path key={y} d={`M${i % 2 ? value === 'right' ? 10 : value === 'center' ? 6 : 3 : 3} ${y}h${i % 2 ? 11 : 18}`} />)}
        </svg>
      </button>)}
      {(['headerRow', 'headerColumn'] as const).map(key => <button key={key} aria-label={ui(key === 'headerRow' ? '标题行' : '标题列')}
        aria-pressed={key === 'headerRow' ? element.headerRow !== false : !!element.headerColumn}
        onMouseDown={event => {
          event.preventDefault(); event.stopPropagation()
          const value = key === 'headerRow' ? element.headerRow === false : !element.headerColumn
          const path=ReactEditor.findPath(editor,element)
          HistoryEditor.withNewBatch(editor, () => Transforms.setNodes(editor, { [key]: value }, { at:path }))
          focusTable(path)
        }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
          <path d={key === 'headerRow' ? 'M3 3h18v6H3z' : 'M3 3h6v18H3z'} fill="currentColor" stroke="none" />
        </svg>
      </button>)}
    </div>, hostDocument().body)}
    {insertions.length > 0 && createPortal(<div ref={insertRef} contentEditable={false}>
      {insertions.map(insertion => <div key={insertion.axis} className="wysimark-overlay wysimark-table-actions wysimark-table-insert" data-table-insert={insertion.axis} data-insert-index={insertion.index} style={{ position: 'fixed', left: insertion.left, top: insertion.top }}>
      <button aria-label={ui(insertion.axis === 'row' ? insertion.index === element.children.length ? '下方插入行' : '上方插入行' : insertion.index === element.columns.length ? '右侧插入列' : '左侧插入列')} onMouseDown={event => { event.preventDefault(); event.stopPropagation(); insert(insertion) }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>
      </button>
      </div>)}
    </div>, hostDocument().body)}
  </>
}
