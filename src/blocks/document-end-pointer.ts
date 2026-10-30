import { Editor, Element, Text, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor } from 'slate-react'
import { clearBlockSelection } from './selection'
import { startPointerSelection } from './pointer-selection'

/** Only the page background below the final block starts a new trailing paragraph. */
export function selectDocumentEndFromPointer(editor: Editor, event: MouseEvent, container: HTMLElement): boolean {
  if (editor.wysimark.readOnly || event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false
  const target = event.target as HTMLElement
  if (target.closest('button,input,textarea,select,a,[role="menu"],[data-wysimark-toolbar],[data-wysimark-image-resize],[data-wysimark-block]')) return false
  const lastIndex = editor.children.length - 1, last = editor.children[lastIndex]
  if (!last) return false
  const editable = ReactEditor.toDOMNode(editor, editor)
  const bounds = editable.getBoundingClientRect()
  if (!container.contains(target) || event.clientX < bounds.left || event.clientX > bounds.right) return false
  const lastBounds = ReactEditor.toDOMNode(editor, last).getBoundingClientRect()
  if (event.clientY <= lastBounds.bottom) return false
  event.preventDefault(); event.stopPropagation()
  clearBlockSelection(editor)
  const empty = Element.isElement(last) && last.type === 'paragraph' && !last.__collapsible &&
    last.children.every(child => Text.isText(child) && child.text === '')
  if (empty) Transforms.select(editor, Editor.end(editor, [lastIndex]))
  else {
    const insert = () => Editor.withoutNormalizing(editor, () => {
      Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] }, { at: [lastIndex + 1] })
      Transforms.select(editor, Editor.start(editor, [lastIndex + 1]))
      editor.marks = null
    })
    if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, insert)
    else insert()
  }
  ReactEditor.focus(editor)
  if (editor.selection) startPointerSelection(editor, editor.selection.anchor, {
    clientX: event.clientX, clientY: event.clientY, currentTarget: container,
    preventDefault: () => event.preventDefault(),
  })
  return true
}
