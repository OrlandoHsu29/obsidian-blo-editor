import { Editor, Element, Path, Transforms } from "slate"

import { findElementUp, rewrapElement } from "../../sink"

import { isListItem } from ".."
import { ListItemElement } from "../types"

export function insertBreak(editor: Editor): boolean {
  const entry = findElementUp<ListItemElement>(editor, isListItem)
  if (!entry) return false
  const [element, path] = entry
  let empty = Editor.isEmpty(editor, element)
  // Paragraphs split the surrounding item; nested structures such as code,
  // tables and quotes retain their own Enter behavior.
  if (element.blockChildren) {
    const block = Editor.above(editor, {
      match: node => Element.isElement(node) && Editor.isBlock(editor, node), mode: "lowest",
    })
    if (!block || block[0].type !== "paragraph" || !Path.equals(Path.parent(block[1]), path)) return false
    empty = element.children.length === 1 && Editor.isEmpty(editor, block[0])
  }

  /**
   * If we're in an empty list
   */
  if (empty) {
    if (element.depth > 0) {
      /**
       * If it's indented, then unindent it
       */
      Transforms.setNodes(editor, { depth: element.depth - 1 }, { at: path })
      return true
    } else {
      /**
       * If it's fully unindented, turn it into a paragraph
       */
      if (element.blockChildren) Transforms.unwrapNodes(editor, { at: path })
      else rewrapElement(editor, { type: "paragraph" }, path)
      return true
    }
  }
  return splitListItem(editor)
}

/** Split through the list container, retaining content and continuing numbering. */
export function splitListItem(editor: Editor): boolean {
  Editor.withoutNormalizing(editor, () => {
    Transforms.splitNodes(editor, { always: true, match: isListItem, mode: "lowest" })
    const nextEntry = findElementUp<ListItemElement>(editor, isListItem)
    if (!nextEntry) return
    const [next, path] = nextEntry
    if (next.type === "ordered-list-item") {
      Transforms.setNodes(editor, { __numbering: "continue" }, { at: path })
      if (next.start != null) Transforms.unsetNodes(editor, "start", { at: path })
    }
    // A newly created task is always unchecked.
    if (next.type === "task-list-item" && next.checked) {
      Transforms.setNodes(editor, { checked: false }, { at: path })
    }
  })
  return true
}
