import { Editor, Point, Range, Transforms } from 'slate'
import { ReactEditor } from 'slate-react'
import { pointAfterLinkAtEnd } from './link-keyboard'

/** Resolve the caret before input starts, never while an IME owns the DOM. */
export function exitLinkEnd(editor: Editor): boolean {
  if (editor.wysimark?.readOnly || ReactEditor.isComposing(editor)) return false
  const point = pointAfterLinkAtEnd(editor)
  if (!point) return false
  if (!Point.equals(point, editor.selection!.anchor)) Transforms.select(editor, point)
  editor.marks = {}
  editor.activeMarks = {}
  return true
}

export function withLinkEndInput(editor: Editor): void {
  const { apply } = editor
  editor.apply = operation => {
    let boundary = false
    if (operation.type === 'set_selection' && operation.newProperties &&
      !editor.wysimark?.readOnly && !ReactEditor.isComposing(editor)) {
      const next = { ...editor.selection, ...operation.newProperties }
      if (Range.isRange(next)) {
        const point = pointAfterLinkAtEnd(editor, next)
        if (point) {
          boundary = true
          operation = { ...operation, newProperties: { ...operation.newProperties, anchor: point, focus: point } }
        }
      }
    }
    apply(operation)
    if (boundary) { editor.marks = {}; editor.activeMarks = {} }
  }
}

/** Keydown precedes compositionstart; put the native caret outside before IME starts. */
export function prepareLinkEndInput(editor: Editor, doc: Document): void {
  if (!exitLinkEnd(editor)) return
  const selection = doc.getSelection()
  // toDOMRange applies Slate's zero-width caret offset; toDOMPoint alone does not.
  const range = ReactEditor.toDOMRange(editor, editor.selection!)
  const node = range.startContainer, offset = range.startOffset
  if (selection && (selection.anchorNode !== node || selection.anchorOffset !== offset || !selection.isCollapsed)) {
    selection.setBaseAndExtent(node, offset, node, offset)
  }
}

