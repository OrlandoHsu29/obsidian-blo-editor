import { Editor, Element } from "slate"
import { selectionHasHeading } from '../../../blocks/heading-policy'
import { blockDepth, defaultOrderedNumbering } from '../../../blocks/model'
import { convertContainingList } from '../../../blocks/list-container'

import {
  OrderedListItemElement,
  TaskListItemElement,
  UnorderedListItemElement,
} from ".."

export function convertOrderedList(editor: Editor, allowToggle: boolean) {
  if(convertContainingList(editor,'ordered-list-item',allowToggle))return true
  const entries=[...Editor.nodes(editor,{match:node=>Element.isElement(node)&&editor.convertElement.isConvertibleElement(node),mode:'highest'})]
  const converting=new Set(entries.map(([node])=>node))
  const modes=new Map(entries.map(([node,path])=>[node,defaultOrderedNumbering(editor,path,converting)]))
  return editor.convertElement.convertElements<OrderedListItemElement>(
    (element) => element.type === "ordered-list-item",
    (element) => {
      return {
        type: "ordered-list-item",
        depth: blockDepth(element),
        __numbering: modes.get(element) || 'continue',
      }
    },
    allowToggle
  )
}

export function convertTaskList(editor: Editor, allowToggle: boolean) {
  if(selectionHasHeading(editor))return false
  if(convertContainingList(editor,'task-list-item',allowToggle))return true
  return editor.convertElement.convertElements<TaskListItemElement>(
    (element) => element.type === "task-list-item",
    (element) => {
      return {
        type: "task-list-item",
        checked: "checked" in element ? element.checked : false,
        depth: blockDepth(element),
      }
    },
    allowToggle
  )
}

export function convertUnorderedList(editor: Editor, allowToggle: boolean) {
  if(selectionHasHeading(editor))return false
  if(convertContainingList(editor,'unordered-list-item',allowToggle))return true
  return editor.convertElement.convertElements<UnorderedListItemElement>(
    (element) => element.type === "unordered-list-item",
    (element) => {
      return {
        type: "unordered-list-item",
        depth: blockDepth(element),
      }
    },
    allowToggle
  )
}
