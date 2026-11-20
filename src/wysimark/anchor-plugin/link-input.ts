import { Editor, Element, Node, Path, Point, Range, Transforms } from 'slate'
import { ReactEditor } from 'slate-react'
import { isIconOnlyLink, linkAtLabelStart, pointAfterLinkAtEnd } from './link-keyboard'

const replacingLabels = new WeakMap<Editor, { path: Path; link: Node }>()

function linkEndInputPoint(editor: Editor, range = editor.selection): Point | undefined {
  const replacement = replacingLabels.get(editor)
  if (replacement && range && Range.isCollapsed(range) && Path.isAncestor(replacement.path, range.anchor.path) &&
    Node.getIf(editor, replacement.path) === replacement.link) return
  return pointAfterLinkAtEnd(editor, range)
}

/** Resolve the caret before input starts, never while an IME owns the DOM. */
export function exitLinkEnd(editor: Editor): boolean {
  if (editor.wysimark?.readOnly || ReactEditor.isComposing(editor)) return false
  const point = linkEndInputPoint(editor)
  if (!point) return false
  if (!Point.equals(point, editor.selection!.anchor)) Transforms.select(editor, point)
  editor.marks = {}
  editor.activeMarks = {}
  return true
}

export function withLinkEndInput(editor: Editor): void {
  const { apply } = editor
  editor.apply = operation => {
    // An explicit label selection can be deleted and then replaced in place.
    const selection = editor.selection
    const editedLink = operation.type === 'remove_text' && selection && Range.isExpanded(selection) &&
      Editor.above(editor, { at: operation.path, match: node => Element.isElement(node) && node.type === 'anchor' })
    const labelPath = editedLink && selection && Path.isAncestor(editedLink[1], selection.anchor.path) &&
      Path.isAncestor(editedLink[1], selection.focus.path) ? editedLink[1] : undefined
    let boundary = false
    if (operation.type === 'set_selection' && operation.newProperties &&
      !editor.wysimark?.readOnly && !ReactEditor.isComposing(editor)) {
      const next = { ...editor.selection, ...operation.newProperties }
      if (Range.isRange(next)) {
        const point = linkEndInputPoint(editor, next)
        if (point) {
          boundary = true
          operation = { ...operation, newProperties: { ...operation.newProperties, anchor: point, focus: point } }
        }
        const replacement = replacingLabels.get(editor)
        if (replacement && (Range.isExpanded(next) || !Path.isAncestor(replacement.path, next.anchor.path))) replacingLabels.delete(editor)
      }
    }
    apply(operation)
    if (labelPath) {
      const link = Node.getIf(editor, labelPath)
      if (link && isIconOnlyLink(link)) replacingLabels.set(editor, { path: labelPath, link })
    }
    if (boundary) { editor.marks = {}; editor.activeMarks = {} }
  }
}

/** Put the native caret in the appropriate text leaf before IME starts. */
export function prepareLinkBoundaryInput(editor: Editor, doc: Document): void {
  if (editor.wysimark?.readOnly || ReactEditor.isComposing(editor)) return
  if (!exitLinkEnd(editor) && !linkAtLabelStart(editor)) return
  const selection = doc.getSelection()
  // toDOMRange applies Slate's zero-width caret offset; toDOMPoint alone does not.
  const range = ReactEditor.toDOMRange(editor, editor.selection!)
  const node = range.startContainer, offset = range.startOffset
  if (selection && (selection.anchorNode !== node || selection.anchorOffset !== offset || !selection.isCollapsed)) {
    selection.setBaseAndExtent(node, offset, node, offset)
  }
}

