import { Editor, Path, Transforms } from "slate"
import { blockDepth } from '../../../blocks/model'
import { findElementUp, isStartOfElement } from "../../sink"
import { isListItem } from ".."
import { ListItemElement } from "../types"

const MAX_DEPTH = 2

export function getListDepth(editor: Editor): number {
  const listItem = findElementUp<ListItemElement>(editor, isListItem)
  if (!listItem) return 0
  return blockDepth(listItem[0])
}

/** Keep the visible list offset and the shared block hierarchy in sync. */
export function setListDepth(editor:Editor,at:Path,depth:number):void {
  Transforms.setNodes(editor,{depth,__blockDepth:depth},{at})
}

export function canIncreaseDepth(editor: Editor): boolean {
  if (!isStartOfElement(editor, isListItem)) return false
  const depth = getListDepth(editor)
  return depth < MAX_DEPTH
}

export function canDecreaseDepth(editor: Editor): boolean {
  if (!isStartOfElement(editor, isListItem)) return false
  const depth = getListDepth(editor)
  return depth > 0
}

export function increaseDepth(editor: Editor): void {
  if (!canIncreaseDepth(editor)) return
  editor.list.indent()
}

export function decreaseDepth(editor: Editor): void {
  if (!canDecreaseDepth(editor)) return
  editor.list.outdent()
}
