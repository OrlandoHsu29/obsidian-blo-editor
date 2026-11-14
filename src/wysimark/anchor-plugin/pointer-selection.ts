import type { MouseEvent } from 'react'
import { Editor, Element as SlateElement, Node, Path, Point, Range, Text } from 'slate'
import { ReactEditor } from 'slate-react'
import { setPointerSelection, startPointerSelection } from '../../blocks/pointer-selection'
import { pointBeforeLink, selectLink } from './link-keyboard'

/** Shared geometry for starting a gesture and extending one across the icon. */
export function linkIconHit(editor: Editor, link: HTMLAnchorElement, x: number, y: number) {
  const doc = link.ownerDocument, win = doc.defaultView!
  const box = link.querySelector('.wysimark-link-icon')?.getBoundingClientRect(), line = link.getClientRects()[0]
  if (!box || !line) return
  const style = win.getComputedStyle(link), font = parseFloat(style.fontSize) || box.height
  const leading = Math.max(0, (parseFloat(style.lineHeight) || line.height) - line.height) / 2
  const padding = leading + font * .4
  if (y < Math.min(line.top, box.top) - padding || y > Math.max(line.bottom, box.bottom) + padding) return
  const pointedLine = doc.caretRangeFromPoint(x, y)?.getBoundingClientRect()
  if (pointedLine?.height && pointedLine.bottom <= line.top && y <= pointedLine.bottom) return
  if (pointedLine?.height && pointedLine.top >= line.bottom && y >= pointedLine.top) return
  const label = link.querySelector('.wysimark-link-label')?.getClientRects()[0]
  if (x > Math.max(box.right, label?.right ?? box.right)) return
  const path = ReactEditor.findPath(editor, ReactEditor.toSlateNode(editor, link))
  const before = pointBeforeLink(editor, path)
  // A preceding whitespace run is visually part of the gap, but Chromium can
  // map a press there to the label rather than the real leading text boundary.
  const leaf = Node.leaf(editor, before.path)
  const whitespace = leaf.text.slice(0, before.offset).match(/[\t \u00a0]+$/u)?.[0].length ?? 0
  const [node, offset] = ReactEditor.toDOMPoint(editor, { ...before, offset: before.offset - whitespace })
  const caret = doc.createRange(); caret.setStart(node, offset); caret.collapse(true)
  const edge = caret.getBoundingClientRect()
  const left = edge.height && edge.top < box.bottom && edge.bottom > box.top ? Math.min(line.left, edge.left) : line.left
  if (x < left - 1) return
  return { path, before: x <= box.left + box.width * 2 / 3,
    overLabel: x > Math.max(box.right, label?.left ?? box.right) }
}

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
  // The native hit target can be the line container above/below the glyph.
  // Resolve the nearest caret as well, without scanning other document links.
  const hit = doc.elementFromPoint(x, y)?.closest<HTMLAnchorElement>('a[data-link-icon]')
  let startLink = hit
  if (!startLink) {
    const caret = doc.caretRangeFromPoint(x, y)
    const point = caret && ReactEditor.toSlatePoint(editor, [caret.startContainer, caret.startOffset], { exactMatch: false, suppressThrow: true })
    if (point) {
      let entry = Editor.above(editor, { at: point, match: n => SlateElement.isElement(n) && n.type === 'anchor' })
      if (!entry && Text.isText(Node.get(editor, point.path))) {
        const next = Path.next(point.path)
        if (Node.has(editor, next)) {
          const node = Node.get(editor, next)
          if (SlateElement.isElement(node) && node.type === 'anchor') entry = [node, next]
        }
      }
      if (entry) startLink = ReactEditor.toDOMNode(editor, entry[0]) as HTMLAnchorElement
    }
  }
  if (startLink && host.contains(startLink)) {
    const hit = linkIconHit(editor, startLink, x, y)
    if (hit && !hit.overLabel) {
      event.stopPropagation()
      const cleanup = startPointerSelection(editor, pointBeforeLink(editor, hit.path), event)
      selectLink(editor, hit.path)
      return cleanup
    }
  }
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
      const hit = linkIconHit(editor, link, event.clientX, event.clientY)
      if (!hit) continue
      const { path } = hit
      const before = pointBeforeLink(editor, path)
      if (hit.overLabel) {
        current = native && ReactEditor.toSlateRange(editor, native, { exactMatch: false, suppressThrow: true })
        // At the label's first caret, Chromium may retain the equivalent point
        // outside an inline. Prefer the real text point once back over the label.
        if (!current || !Point.equals(current.focus, before) && !Point.equals(current.focus, Editor.start(editor, path))) continue
      }
      target = hit
      lastLink = link
      break
    }
    current ??= native && ReactEditor.toSlateRange(editor, native, { exactMatch: false, suppressThrow: true })
    // Chromium can restart its native drag anchor at the label's first text
    // point after crossing contentEditable=false. Keep the original anchor
    // throughout the gesture, including after the pointer leaves the icon.
    const range = target ? linkIconSelectionRange(editor, target.path, anchor.current, target.before) :
      current ? { anchor: anchor.current, focus: current.focus } : undefined
    if (!range) return
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
