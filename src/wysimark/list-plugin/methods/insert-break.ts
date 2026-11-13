import { Editor, Element, Node, Path, Range, Transforms } from "slate"
import { groupEnd, listHeadingLevel, MAX_BODY_LIST_NUMBER, resolveOrderedNumbers, rootCache } from '../../../blocks/model'
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
    if (foldedListEnd(editor, entry) !== undefined) return splitListItem(editor)
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

/** Enter after a folded parent must skip its hidden descendants. */
function foldedListEnd(editor: Editor, [node,path]: [ListItemElement, Path]): number | undefined {
  if (path.length !== 1 || !Element.isElement(node) || !node.__collapsed ||
    !editor.selection || !Range.isCollapsed(editor.selection) ||
    !Editor.isEnd(editor, editor.selection.focus, path) || !rootCache(editor).foldable.has(node)) return
  return groupEnd(editor.children, path[0])
}

/** Split through the list container, retaining content and continuing numbering. */
export function splitListItem(editor: Editor): boolean {
  const current=findElementUp<ListItemElement>(editor,isListItem)
  const siblingIndex=current?foldedListEnd(editor,current):undefined
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
    // Split first to reuse normal list/mark rules, then move only the newborn
    // sibling. Its selection follows the move; the parent's children stay folded.
    if(siblingIndex!==undefined)Transforms.moveNodes(editor,{at:path,to:[siblingIndex]})
  })
  return true
}
