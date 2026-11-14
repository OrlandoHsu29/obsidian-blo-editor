import { Platform } from 'obsidian'
import { Editor, Transforms } from 'slate'
import { ReactEditor } from 'slate-react'

/** Let Chromium resolve linguistic word boundaries, including unspaced CJK. */
export function handleWordNavigation(editor: Editor, event: KeyboardEvent): boolean {
  if (editor.wysimark.readOnly || !editor.selection || event.isComposing ||
    event.defaultPrevented || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return false
  const wordModifier = Platform.isMacOS ? event.altKey && !event.ctrlKey && !event.metaKey
    : event.ctrlKey && !event.altKey && !event.metaKey
  if (!wordModifier) return false
  const host = ReactEditor.toDOMNode(editor, editor), selection = host.ownerDocument.getSelection()
  if (!selection?.modify || !selection.anchorNode || !selection.focusNode ||
    !host.contains(selection.anchorNode) || !host.contains(selection.focusNode)) return false
  // Slate may already be ahead of the debounced native selection on key repeat.
  const [anchor, a] = ReactEditor.toDOMPoint(editor, editor.selection.anchor)
  const [focus, f] = ReactEditor.toDOMPoint(editor, editor.selection.focus)
  const restore = () => selection.setBaseAndExtent(anchor, a, focus, f)
  restore()
  selection.modify(event.shiftKey ? 'extend' : 'move', event.key === 'ArrowLeft' ? 'left' : 'right', 'word')
  if (!selection.anchorNode || !selection.focusNode || !host.contains(selection.anchorNode) || !host.contains(selection.focusNode)) {
    restore(); return false
  }
  const range = ReactEditor.toSlateRange(editor, selection, { exactMatch: false, suppressThrow: true })
  if (!range) { restore(); return false }
  Transforms.select(editor, range)
  event.preventDefault(); event.stopPropagation()
  return true
}
