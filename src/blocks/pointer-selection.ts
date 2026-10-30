import type { MouseEvent } from 'react'
import { Editor, Point, Transforms } from 'slate'
import { ReactEditor } from 'slate-react'

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

/** Preserve the real Slate anchor when a boundary click replaces native mousedown. */
export function startPointerSelection(editor: Editor, point: Point,
  event: Pick<MouseEvent<HTMLElement>, 'clientX' | 'clientY' | 'currentTarget' | 'preventDefault'>): () => void {
  resetPointerSelection(editor)
  const anchor = Editor.pointRef(editor, point)
  const doc = event.currentTarget.ownerDocument, win = doc.defaultView!
  const startX = event.clientX, startY = event.clientY
  const session: Session = { suppressClickUntil: 0 }
  sessions.set(editor, session)
  event.preventDefault()
  ReactEditor.focus(editor)
  Transforms.select(editor, point)
  let active = true, moved = false
  const cleanup = () => {
    if (!active) return
    active = false
    anchor.unref()
    doc.removeEventListener('mousemove', move, true)
    doc.removeEventListener('mouseup', up, true)
    win.removeEventListener('blur', cleanup)
    doc.documentElement.classList.remove('blo-selecting-from-boundary')
    session.cleanup = undefined
  }
  const up = () => {
    // A drag can still produce a click. Void blocks and gutter clicks would
    // otherwise collapse the selection that was just extended.
    if (moved) session.suppressClickUntil = Date.now() + 500
    cleanup()
  }
  const move = (event: globalThis.MouseEvent) => {
    if (!(event.buttons & 1) || !anchor.current) { cleanup(); return }
    if (!moved && Math.hypot(event.clientX - startX, event.clientY - startY) < 3) return
    // Floating controls must not intercept the text under a selection drag.
    doc.documentElement.classList.add('blo-selecting-from-boundary')
    const hit = doc.caretRangeFromPoint(event.clientX, event.clientY)
    if (!hit || !ReactEditor.toDOMNode(editor, editor).contains(hit.startContainer)) return
    const focus = ReactEditor.toSlatePoint(editor, [hit.startContainer, hit.startOffset], { exactMatch: false, suppressThrow: true })
    if (!focus) return
    moved = true
    event.preventDefault()
    const range = { anchor: anchor.current, focus }
    Transforms.select(editor, range)
    const [a, offset] = ReactEditor.toDOMPoint(editor, range.anchor)
    const [f, end] = ReactEditor.toDOMPoint(editor, range.focus)
    doc.getSelection()?.setBaseAndExtent(a, offset, f, end)
  }
  session.cleanup = cleanup
  doc.addEventListener('mousemove', move, true)
  doc.addEventListener('mouseup', up, true)
  win.addEventListener('blur', cleanup)
  return cleanup
}
