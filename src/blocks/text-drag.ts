import type { DragEvent } from 'react'
import { Editor, Point, Range, Transforms } from 'slate'
import { ReactEditor } from 'slate-react'
import { isDomElement } from '../dom-guards'
import { withHistoryBatch } from '../wysimark/utils/with-history-batch'

const dragType = 'application/x-blo-text-move'
type TextDrag = { id: string; range: ReturnType<typeof Editor.rangeRef> }
const textDrags = new WeakMap<Editor, TextDrag>()
let nextDragId = 0

export function clearTextDrag(editor: Editor) {
  textDrags.get(editor)?.range.unref()
  textDrags.delete(editor)
}

export function startTextDrag(editor: Editor, event: DragEvent<HTMLElement>): boolean {
  const { target, currentTarget, dataTransfer } = event
  if (!isDomElement(target) || target.closest('[contenteditable="false"],[draggable="true"]')) return false
  const native = currentTarget.ownerDocument.getSelection()
  if (!native?.anchorNode || !native.focusNode || !currentTarget.contains(native.anchorNode) ||
    !currentTarget.contains(native.focusNode)) return false
  const range = ReactEditor.toSlateRange(editor, native, { exactMatch: false, suppressThrow: true })
  if (!range || Range.isCollapsed(range)) return false
  clearTextDrag(editor)
  Transforms.select(editor, range)
  ReactEditor.setFragmentData(editor, dataTransfer, 'drag')
  // Cells set their own transfer format and are routed by the table plugin.
  if (!dataTransfer.types.includes('application/x-slate-fragment')) return true
  const id = String(++nextDragId)
  dataTransfer.setData(dragType, id)
  dataTransfer.effectAllowed = 'copyMove'
  textDrags.set(editor, { id, range: Editor.rangeRef(editor, range, { affinity: 'inward' }) })
  return true
}

export function textDragOver(editor: Editor, event: DragEvent<HTMLElement>) {
  if (!textDrags.has(editor) || !event.dataTransfer.types.includes(dragType)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = event.ctrlKey || event.altKey ? 'copy' : 'move'
}

export function moveTextSelection(editor: Editor, range: Range, point: Point, copy = false) {
  if (Range.isCollapsed(range) || Range.includes(range, point) || Editor.void(editor, { at: point })) return false
  Transforms.select(editor, range)
  const fragment = editor.getFragment()
  if (!fragment.length) return false
  const destination = Editor.pointRef(editor, point)
  try {
    withHistoryBatch(editor, () => {
      if (!copy) Transforms.delete(editor, { at: range })
      if (destination.current) {
        Transforms.select(editor, destination.current)
        editor.insertFragment(fragment)
      }
    })
  } finally {
    destination.unref()
  }
  return true
}

export function dropTextDrag(editor: Editor, event: DragEvent<HTMLElement>) {
  const drag = textDrags.get(editor)
  if (!drag || event.dataTransfer.getData(dragType) !== drag.id) return
  const range = drag.range.current
  clearTextDrag(editor)
  event.preventDefault()
  if (!range) return
  let point: Point
  try {
    point = ReactEditor.findEventRange(editor, event).anchor
  } catch {
    return
  }
  if (moveTextSelection(editor, range, point, event.ctrlKey || event.altKey)) ReactEditor.focus(editor)
}
