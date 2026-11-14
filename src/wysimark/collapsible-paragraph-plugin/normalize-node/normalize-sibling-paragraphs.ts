import { Editor, Element, NodeEntry, Transforms } from "slate"

import { normalizeSiblings } from "../../sink"

import { ParagraphElement } from ".."
import { isEditorSpacer } from '../../../blocks/model'

function isParagraph(node: Element): node is ParagraphElement {
  return Element.isElement(node) && node.type === "paragraph"
}
/**
 * If there are two sibling paragraphs next to each other and they are both
 * marked as `__collapsible`, this indicates to us that some kind of wall
 * Element was removed.
 *
 * These two collapsible paragraphs should then be merged into one.
 */
export function normalizeSiblingParagraphs(
  editor: Editor,
  entry: NodeEntry<Element>
): boolean {
  return normalizeSiblings(editor, entry, (a, b) => {
    if (!isParagraph(b[0]) || !isEditorSpacer(b[0])) return false
    if (isEditorSpacer(a[0])) {
      Transforms.removeNodes(editor, { at: a[1] })
      return true
    }
    // A converted/deleted wall can leave its old insertion paragraph behind.
    // Editable text already provides the caret, so only the spacer is removed.
    if (Editor.hasInlines(editor, a[0]) && !Editor.isVoid(editor, a[0])) {
      Transforms.removeNodes(editor, { at: b[1] })
      return true
    }
    return false
  })
}
