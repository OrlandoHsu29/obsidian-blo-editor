import { Editor, Element, Node, Path, Transforms } from "slate"
import { listHeadingLevel, MAX_BODY_LIST_NUMBER, resolveOrderedNumbers, rootCache } from '../../../blocks/model'
import { setListBlock } from '../../../blocks/list-container'
import { setListDepth, getListDepth } from './depth'

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
    const depth=getListDepth(editor)
    if (depth > 0) {
      /**
       * If it's indented, then unindent it
       */
      setListDepth(editor,path,depth-1)
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
  const current=findElementUp<ListItemElement>(editor,isListItem)
  const capped=current&&current[0].type==='ordered-list-item'&&listHeadingLevel(current[0])===undefined&&
    (rootCache(editor).numbers.get(current[0])??resolveOrderedNumbers(Node.parent(editor,current[1]).children).numbers.get(current[0])??1)>=MAX_BODY_LIST_NUMBER
  Editor.withoutNormalizing(editor, () => {
    Transforms.splitNodes(editor, { always: true, match: isListItem, mode: "lowest" })
    const nextEntry = findElementUp<ListItemElement>(editor, isListItem)
    if (!nextEntry) return
    const [next, path] = nextEntry
    if('__collapsed' in next&&next.__collapsed)Transforms.unsetNodes(editor,'__collapsed',{at:path})
    if (next.type === "ordered-list-item") {
      Transforms.setNodes(editor, { __numbering: "continue" }, { at: path })
      if (next.start != null) Transforms.unsetNodes(editor, "start", { at: path })
    }
    // A newly created task is always unchecked.
    if (next.type === "task-list-item" && next.checked) {
      Transforms.setNodes(editor, { checked: false }, { at: path })
    }
    if(capped)setListBlock(editor,next,path)
  })
  return true
}
