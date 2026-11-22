import type { MouseEvent } from 'react'
import { Editor, Point, Range, Transforms } from 'slate'
import { ReactEditor } from 'slate-react'
import { mediaContentSelector } from './structured-block'
import { rangeToMediaBlock } from './boundary'
import { isDomElement } from '../dom-guards'

type Session = { cleanup?: () => void; suppressClickUntil: number }
const sessions = new WeakMap<Editor, Session>()

export function isPointerSelecting(editor: Editor): boolean {
  return !!sessions.get(editor)?.cleanup
}

export function resetPointerSelection(editor: Editor) {
  sessions.get(editor)?.cleanup?.()
  sessions.delete(editor)
}

export function consumePointerSelectionClick(editor: Editor): boolean {
  const session = sessions.get(editor)
  if (!session || Date.now() > session.suppressClickUntil) return false
  session.suppressClickUntil = 0
  return true
}

export function preservePointerSelectionClick(editor: Editor) {
  const session = sessions.get(editor) ?? { suppressClickUntil: 0 }
  session.suppressClickUntil = Date.now() + 500
  sessions.set(editor, session)
}

/** Keep the browser and Slate pointed at the same real document range. */
export function setPointerSelection(editor: Editor, range: Range, doc: Document) {
  Transforms.select(editor, range)
  range = editor.selection ?? range
  const [a, offset] = ReactEditor.toDOMPoint(editor, range.anchor)
  const [f, end] = ReactEditor.toDOMPoint(editor, range.focus)
  const native=doc.getSelection()
  if(native&&(native.anchorNode!==a||native.anchorOffset!==offset||native.focusNode!==f||native.focusOffset!==end))native.setBaseAndExtent(a, offset, f, end)
}

/** Hit-test only the pointed media; never scan the document during a drag. */
export function mediaRangeFromPointer(editor: Editor, host: HTMLElement, x: number, y: number, anchor: Point): Range | undefined {
  const media=host.ownerDocument.elementFromPoint(x,y)?.closest<HTMLElement>(mediaContentSelector)
  if(!media||!host.contains(media))return
  try {
    const node=ReactEditor.toSlateNode(editor,media.closest('[data-slate-node="element"]')??media),path=ReactEditor.findPath(editor,node)
    return rangeToMediaBlock(editor,path[0],anchor)
  } catch { return }
}

export function tableCellFromPointer(target: EventTarget | null, x: number, y: number): HTMLElement | undefined {
  const cell = isDomElement(target) ? target.closest<HTMLElement>('td,th') : null
  if (!cell) return
  const bounds = cell.getBoundingClientRect()
  if (x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom) return cell
}

/** The browser can return a cell caret even when the pointer is outside the grid. */
export function tableGapFromPointer(editor: Editor, host: HTMLElement, x: number, y: number): { outside?: Point; edge: Point } | undefined {
  const doc=host.ownerDocument
  const hit = doc.elementFromPoint(x, y)
  if (hit?.closest('[data-table-axis],button') || tableCellFromPointer(hit, x, y)) return
  let frame = hit?.closest<HTMLElement>('.blo-table-frame')
  if(!frame){
    const caret=doc.caretRangeFromPoint(x,y),node=caret?.startContainer
    frame=(node?.nodeType===1?node as HTMLElement:node?.parentElement)?.closest<HTMLElement>('.blo-table-frame')
  }
  const table=frame?.querySelector('table')
  if(!frame||!table||!host.contains(frame))return
  const bounds=frame.getBoundingClientRect(),content=table.getBoundingClientRect()
  if (x < bounds.left || x > bounds.right || y >= content.top && y <= content.bottom && !frame.contains(hit)) return
  const scroll = frame.querySelector<HTMLElement>('.blo-table-scroll')
  if (scroll && frame.dataset.overflow === 'true' && scroll.offsetHeight > scroll.clientHeight) {
    const box = scroll.getBoundingClientRect()
    const trackTop = box.top + box.height * scroll.clientHeight / scroll.offsetHeight
    if (y >= trackTop && y <= box.bottom) return
  }
  try {
    const path=ReactEditor.findPath(editor,ReactEditor.toSlateNode(editor,table))
    const above = y < content.top
    const adjacent = above ? Editor.before : Editor.after
    let outside = adjacent(editor, path)
    while (outside) {
      const neighbor = Editor.above(editor, { at: outside, match: node => 'type' in node && node.type === 'table' })
      if (!neighbor) break
      outside = adjacent(editor, neighbor[1])
    }
    return { outside, edge: above ? Editor.start(editor, path) : Editor.end(editor, path) }
  } catch { return }
}

export function tableEdgeRangeFromPointer(editor: Editor, host: HTMLElement, x: number, y: number, anchor: Point): Range | undefined {
  const gap = tableGapFromPointer(editor, host, x, y)
  if (gap) return { anchor, focus: gap.outside ?? gap.edge }
}

/** Once a drag crosses non-editable media, resolve its endpoint from the
 * pointer, rather than reading back the DOM selection we just corrected. */
export function pointerRangeFromPoint(editor: Editor, host: HTMLElement, x: number, y: number, anchor: Point): Range | undefined {
  const media = mediaRangeFromPointer(editor, host, x, y, anchor)
  if (media) return media
  const tableEdge=tableEdgeRangeFromPointer(editor,host,x,y,anchor)
  if(tableEdge)return tableEdge
  const hit = host.ownerDocument.caretRangeFromPoint(x, y)
  if (!hit || !host.contains(hit.startContainer)) return
  const focus = ReactEditor.toSlatePoint(editor, [hit.startContainer, hit.startOffset], { exactMatch: false, suppressThrow: true })
  if (!focus) return
  // Chromium can map a frame's border to the void's hidden text leaf.
  // That leaf still represents the complete media, not an empty text range.
  return rangeToMediaBlock(editor, focus.path[0], anchor) ?? { anchor, focus }
}

/** Preserve the real Slate anchor when a boundary click replaces native mousedown. */
export function startPointerSelection(editor: Editor, point: Point,
  event: Pick<MouseEvent<HTMLElement>, 'clientX' | 'clientY' | 'currentTarget' | 'preventDefault'>, placeCaret = true): () => void {
  resetPointerSelection(editor)
  const anchor = Editor.pointRef(editor, point)
  const host = event.currentTarget, doc = host.ownerDocument, win = doc.defaultView!
  const startX = event.clientX, startY = event.clientY
  const session: Session = { suppressClickUntil: 0 }
  sessions.set(editor, session)
  event.preventDefault()
  ReactEditor.focus(editor)
  if (placeCaret) Transforms.select(editor, point)
  else Transforms.deselect(editor)
  let active = true, moved = false
  const cleanup = () => {
    if (!active) return
    active = false
    anchor.unref()
    doc.removeEventListener('mousemove', move, true)
    doc.removeEventListener('mouseup', up, true)
    doc.removeEventListener('dragstart', preventDrag, true)
    win.removeEventListener('blur', cleanup)
    doc.documentElement.classList.remove('blo-selecting-from-boundary')
    session.cleanup = undefined
  }
  const up = (event: globalThis.MouseEvent) => {
    if (event.button) return
    if (anchor.current && moved) {
      const range = pointerRangeFromPoint(editor, host, event.clientX, event.clientY, anchor.current)
      if (range) {
        moved = true
        event.preventDefault()
        setPointerSelection(editor, range, doc)
      }
    }
    // A drag can still produce a click. Void blocks and gutter clicks would
    // otherwise collapse the selection that was just extended.
    if (moved) preservePointerSelectionClick(editor)
    cleanup()
  }
  const preventDrag = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }
  const move = (event: globalThis.MouseEvent) => {
    if (!(event.buttons & 1) || !anchor.current) { cleanup(); return }
    if (!moved && Math.hypot(event.clientX - startX, event.clientY - startY) < 3) return
    // Floating controls must not intercept the text under a selection drag.
    doc.documentElement.classList.add('blo-selecting-from-boundary')
    const range=pointerRangeFromPoint(editor,host,event.clientX,event.clientY,anchor.current)
    if (!range) return
    moved = true
    event.preventDefault()
    setPointerSelection(editor, range, doc)
  }
  session.cleanup = cleanup
  doc.addEventListener('mousemove', move, true)
  doc.addEventListener('mouseup', up, true)
  doc.addEventListener('dragstart', preventDrag, true)
  win.addEventListener('blur', cleanup)
  return cleanup
}
