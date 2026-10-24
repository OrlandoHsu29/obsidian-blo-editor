import { Editor, Element, Node, Path, Range, Transforms } from "slate"

import { blockDepth } from "../../blocks/model"
import { findElementUp } from "../sink"
import { HeadingElement } from "./types"
import { splitListItem } from "../list-plugin/methods/insert-break"

export function insertBreak(editor: Editor) {
  const entry = findElementUp<HeadingElement>(editor, "heading")
  if (!entry) return false
  if (!editor.selection) return false
  if (Range.isExpanded(editor.selection)) return false
  const parentPath = Path.parent(entry[1])
  const parent = Node.get(editor, parentPath)
  const numberedHeading = Element.isElement(parent) && parent.type === "ordered-list-item" &&
    parent.blockChildren && parent.children[0] === entry[0]
  const nextPath = Path.next(numberedHeading ? parentPath : entry[1])
  if (!Editor.isEnd(editor, editor.selection.anchor, entry[1])) {
    if (!numberedHeading) return false
    // Split the enclosing list item as well as its heading, so the second
    // heading becomes an independent block with continuing numbering.
    return splitListItem(editor)
  }
  Transforms.insertNodes(
    editor,
    { type: "paragraph", ...(numberedHeading ? { __blockDepth: blockDepth(parent) } : {}), children: [{ text: "" }] },
    { at: nextPath }
  )
  Transforms.select(editor, {
    anchor: Editor.start(editor, nextPath),
    focus: Editor.start(editor, nextPath),
  })
  return true
}
