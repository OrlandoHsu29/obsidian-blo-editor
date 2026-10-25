import { ui } from "../../utils/translations"
import { Editor, Element } from "slate"
import { MenuItemData } from "../../shared-overlays"

import * as Icon from "../icons"
import { t } from "../../utils/translations"
import { TextColorMenu } from '../components/dialog/text-color-menu'

function getMarks(editor: Editor) {
  const marks = Editor.marks(editor)
  return {
    bold: marks?.bold || false,
    italic: marks?.italic || false,
    strike: marks?.strike || false,
    code: !!editor.selection && !!Editor.above(editor, { match: node => Element.isElement(node) && node.type === 'inline-code' }),
    underline: marks?.underline || false,
  }
}

const primaryMarkItems: MenuItemData[] = [
  {
    icon: Icon.TextColor,
    title: ui("字体颜色"),
    more: true,
    Component: TextColorMenu,
  },
  {
    icon: Icon.Bold,
    title: t("bold"),
    hotkey: "mod+b",
    action: (editor) => editor.marksPlugin.toggleBold(),
    active: (editor) => getMarks(editor).bold,
  },
  {
    icon: Icon.Italic,
    title: t("italic"),
    hotkey: "mod+i",
    action: (editor) => editor.marksPlugin.toggleItalic(),
    active: (editor) => getMarks(editor).italic,
  },
  {
    icon: Icon.Strikethrough,
    title: t("strike"),
    hotkey: "mod+shift+x",
    action: (editor) => editor.marksPlugin.toggleStrike(),
    active: (editor) => getMarks(editor).strike,
  },
  {
    icon: Icon.Code,
    title: t("inlineCode"),
    hotkey: "mod+e",
    action: (editor) => editor.inlineCode.toggleInlineCode(),
    active: (editor) => getMarks(editor).code,
  },
  {
    icon: Icon.Underline,
    title: t("underline"),
    hotkey: "mod+u",
    action: (editor) => editor.marksPlugin.toggleUnderline(),
    active: (editor) => getMarks(editor).underline,
  },
]

export const expandedMarkItems: MenuItemData[] = primaryMarkItems
export const compactMarkItems: MenuItemData[] = [
  {
    icon: Icon.Bold,
    title: t("format"),
    more: true,
    children: primaryMarkItems,
  },
]
