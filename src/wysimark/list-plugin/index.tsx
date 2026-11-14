import { Editor, Element, Transforms } from "slate"
import { deleteHeadingListPrefix, headingListControlDisabled } from '../../blocks/heading-numbering'

import {
  createHotkeyHandler,
  createIsElementType,
  createPlugin,
  curryOne,
  findElementUp,
  isStartOfElement,
  TypedPlugin,
} from "../sink"

import { createListMethods } from "./methods"
import { normalizeNode } from "./normalize-node"
import { renderElement } from "./render-element"
import { ListItemElement, ListPluginCustomTypes } from "./types"
import { setListDepth } from './methods/depth'

export * from "./types"

export const LIST_ITEM_TYPES: ListItemElement["type"][] = [
  "unordered-list-item",
  "ordered-list-item",
  "task-list-item",
]

export const isListItem = createIsElementType<ListItemElement>(LIST_ITEM_TYPES)

export const ListPlugin = createPlugin<ListPluginCustomTypes>(
  (editor, _options, { createPolicy }) => {
    const { shouldMergeNodesRemovePrevNode } = editor
    editor.shouldMergeNodesRemovePrevNode = (previous, current) => {
      // An empty list item still owns its marker, indentation and task state.
      // Backspace from following prose must merge into it rather than replace it.
      if (isListItem(previous[0]) && !previous[0].blockChildren &&
        Element.isElement(current[0]) && Editor.hasInlines(editor, current[0])) return false
      return shouldMergeNodesRemovePrevNode(previous, current)
    }
    editor.convertElement.addConvertElementType(LIST_ITEM_TYPES)
    const list = (editor.list = createListMethods(editor))
    const hotkeyHandler = createHotkeyHandler({
      tab: list.indent,
      "shift+tab": list.outdent,
      "super+7": () => headingListControlDisabled(editor,'number') ? true : list.convertOrderedList(true),
      "super+8": () => headingListControlDisabled(editor,'hash') ? true : list.convertUnorderedList(true),
      "super+9": curryOne(list.convertTaskList, true),
    })

    return createPolicy({
      name: "list",
      editor: {
        normalizeNode: (entry) => normalizeNode(editor, entry),
        insertBreak: list.insertBreak,
        deleteBackward: (unit) => {
          if (unit !== "character") return false
          if (deleteHeadingListPrefix(editor)) return true
          if (!isStartOfElement(editor, isListItem)) return false
          const listItem = findElementUp<ListItemElement>(editor, isListItem)
          if (!listItem) return false
          const [element, path] = listItem
          const depth=list.getListDepth()
          if (depth > 0 && !Editor.isEmpty(editor, element)) {
            setListDepth(editor,path,depth-1)
            return true
          }
          if (element.blockChildren) {
            Transforms.unwrapNodes(editor, { at: path })
            return true
          }
          editor.collapsibleParagraph.convertParagraph({ preserveOrderedLists: false })
          return true
        },
      },
      editableProps: {
        renderElement,
        onKeyDown(e) {
          if (!Editor.nodes(editor, { match: isListItem })) return false
          return hotkeyHandler(e)
        },
      },
    })
  }
) as TypedPlugin<ListPluginCustomTypes>
