import type { MouseEvent } from 'react'
import { Editor, Point, Range } from 'slate'
import { ReactEditor } from 'slate-react'
import { setPointerSelection } from '../../blocks/pointer-selection'
import { pointBeforeLink } from './link-keyboard'

/** The icon occupies the interval between the preceding text and label start. */
export function linkIconSelectionRange(editor: Editor, path: number[], anchor: Point, beforeIcon?: boolean): Range {
  const start = Editor.start(editor, path)
  const before = beforeIcon ?? Point.compare(anchor, start) >= 0
  return { anchor, focus: before ? pointBeforeLink(editor, path) : start }
}

/** Correct native dragging only over icons; leave label characters to the browser. */
export function trackLinkIconSelection(editor: Editor, event: MouseEvent<HTMLElement>): (() => void) | undefined {
  if (editor.wysimark.readOnly || event.button !== 0 || event.detail > 1 ||
    event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
  const host = event.currentTarget, doc = host.ownerDocument, win = doc.defaultView!
  const x = event.clientX, y = event.clientY
  let anchor: ReturnType<typeof Editor.pointRef> | undefined, moved = false, frame = 0
  let pointer: globalThis.MouseEvent | undefined
  let lastLink: HTMLAnchorElement | undefined
  const cleanup = () => {
    anchor?.unref(); anchor = undefined
    lastLink = undefined; pointer = undefined
    doc.removeEventListener('mousemove', move, true)
    doc.removeEventListener('mouseup', up, true)
    doc.removeEventListener('selectionchange', selectionChanged, true)
    win.cancelAnimationFrame(frame); frame = 0
    win.removeEventListener('blur', cleanup)
  }
  const correct = (event: globalThis.MouseEvent) => {
    if (!anchor?.current) return
    const native = doc.getSelection(), node = native?.focusNode
    const focusElement = node?.nodeType === 1 ? node as Element : node?.parentElement
    const hit = doc.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLAnchorElement>('a[data-link-icon]')
    const focused = focusElement?.closest<HTMLAnchorElement>('a[data-link-icon]')
    let current: Range | null | undefined
    // The icon's margins and leading edge still belong to its selection boundary.
    // Hit testing the painted glyph alone drops the icon when moving farther left.
    let target: { path: number[]; before: boolean } | undefined
    for (const link of new Set([hit, focused, lastLink])) {
      if (!link || !host.contains(link)) continue
      const box = link.querySelector('.wysimark-link-icon')?.getBoundingClientRect(), line = link.getClientRects()[0]
      if (!box || !line) continue
      const style = win.getComputedStyle(link), font = parseFloat(style.fontSize) || box.height
      const leading = Math.max(0, (parseFloat(style.lineHeight) || line.height) - line.height) / 2
      const padding = leading + font * .4
      const top = Math.min(line.top, box.top) - padding, bottom = Math.max(line.bottom, box.bottom) + padding
      if (event.clientY < top || event.clientY > bottom) continue
      const pointedLine = doc.caretRangeFromPoint(event.clientX, event.clientY)?.getBoundingClientRect()
      if (pointedLine?.height && pointedLine.bottom <= line.top && event.clientY <= pointedLine.bottom) continue
      if (pointedLine?.height && pointedLine.top >= line.bottom && event.clientY >= pointedLine.top) continue
      const label = link.querySelector('.wysimark-link-label')?.getClientRects()[0]
      if (event.clientX > Math.max(box.right, label?.right ?? box.right)) continue
      const path = ReactEditor.findPath(editor, ReactEditor.toSlateNode(editor, link))
      const before = pointBeforeLink(editor, path)
      if (event.clientX > Math.max(box.right, label?.left ?? box.right)) {
        current = native && ReactEditor.toSlateRange(editor, native, { exactMatch: false, suppressThrow: true })
        // At the label's first caret, Chromium may retain the equivalent point
        // outside an inline. Prefer the real text point once back over the label.
        if (!current || !Point.equals(current.focus, before) && !Point.equals(current.focus, Editor.start(editor, path))) continue
      }
      const [node, offset] = ReactEditor.toDOMPoint(editor, before)
      const caret = doc.createRange(); caret.setStart(node, offset); caret.collapse(true)
      const edge = caret.getBoundingClientRect()
      const left = edge.height && edge.top < box.bottom && edge.bottom > box.top ? Math.min(line.left, edge.left) : line.left
      if (event.clientX < left) continue
      target = { path, before: event.clientX <= box.left + box.width * 2 / 3 }
      lastLink = link
      break
    }
    if (!target) return
    const range = linkIconSelectionRange(editor, target.path, anchor.current, target.before)
    current ??= native && ReactEditor.toSlateRange(editor, native, { exactMatch: false, suppressThrow: true })
    if (editor.selection && Range.equals(editor.selection, range) && current && Range.equals(current, range)) return
    setPointerSelection(editor, range, doc)
  }
  const move = (event: globalThis.MouseEvent) => {
    if (!(event.buttons & 1)) { cleanup(); return }
    if (!moved && Math.hypot(event.clientX - x, event.clientY - y) < 3) return
    moved = true
    if (!anchor) {
      const selection = doc.getSelection()
      const point = selection?.anchorNode && host.contains(selection.anchorNode) && ReactEditor.toSlatePoint(editor,
        [selection.anchorNode, selection.anchorOffset], { exactMatch: false, suppressThrow: true })
      if (!point) return
      anchor = Editor.pointRef(editor, point)
    }
    pointer = event
    // Native selection is updated after mousemove. Normalize it before Slate's
    // selectionchange listener, and once before paint if the native caret did
    // not change while crossing the non-editable icon.
    if (!frame) frame = win.requestAnimationFrame(() => { frame = 0; if (pointer) correct(pointer) })
  }
  const selectionChanged = () => { if (moved && pointer) correct(pointer) }
  const up = (event: globalThis.MouseEvent) => { if (moved) correct(event); cleanup() }
  doc.addEventListener('mousemove', move, true)
  doc.addEventListener('mouseup', up, true)
  doc.addEventListener('selectionchange', selectionChanged, true)
  win.addEventListener('blur', cleanup)
  return cleanup
}
