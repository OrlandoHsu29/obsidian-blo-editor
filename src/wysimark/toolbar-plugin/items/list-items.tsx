import { MenuItemData } from "../../shared-overlays"
import { selectionHasHeading, selectionHasMainHeading } from '../../../blocks/heading-policy'
import { headingListControlDisabled, headingListSelectionActive } from '../../../blocks/heading-numbering'
import { findElementUp } from "../../sink"

import * as Icon from "../icons"
import { t } from "../../utils/translations"
import { listDepthItems } from "./block-items"

const listItemTypes = ["unordered-list-item", "ordered-list-item", "task-list-item"]

export const listItems: MenuItemData[] = [
  {
    icon: Icon.BulletList,
    title: t("bulletList"),
    disabled: editor => headingListControlDisabled(editor,'hash') || (selectionHasHeading(editor)&&!selectionHasMainHeading(editor)),
    hotkey: "mod+shift+8",
    action: (editor) => editor.list.convertUnorderedList(true),
    active: (editor) => headingListSelectionActive(editor,'hash') || !!findElementUp(editor, "unordered-list-item"),
  },
  {
    icon: Icon.ListNumbers,
    title: t("numberedList"),
    disabled: editor => headingListControlDisabled(editor,'number'),
    hotkey: "mod+shift+7",
    action: (editor) => editor.list.convertOrderedList(true),
    active: (editor) => headingListSelectionActive(editor,'number') || !!findElementUp(editor, "ordered-list-item"),
  },
  {
    icon: Icon.ListCheck,
    title: t("checkList"),
    disabled:selectionHasHeading,
    hotkey: "super+9",
    action: (editor) => editor.list.convertTaskList(true),
    active: (editor) => !!findElementUp(editor, "task-list-item"),
  },
]

export const expandedListItems: MenuItemData[] = [...listItems, "divider", ...listDepthItems]

export const compactListItems: MenuItemData[] = [
  {
    icon: Icon.ListNumbers,
    title: t("list"),
    more: true,
    active: (editor) => !!findElementUp(editor, listItemTypes),
    children: [...listItems, "divider", ...listDepthItems],
  },
]
