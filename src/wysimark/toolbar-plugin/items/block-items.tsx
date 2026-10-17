import { MenuItemData } from "../../shared-overlays/types"

import * as Icon from "../icons"
import { t } from "../../utils/translations"

const listDepthItems: MenuItemData[] = [
  {
    icon: Icon.IncreaseDepth,
    title: t("increaseDepth"),
    hotkey: "tab",
    action: (editor) => editor.list.increaseDepth(),
    active: (editor) => editor.list.canIncreaseDepth(),
  },
  {
    icon: Icon.DecreaseDepth,
    title: t("decreaseDepth"),
    hotkey: "shift+tab",
    action: (editor) => editor.list.decreaseDepth(),
    active: (editor) => editor.list.canDecreaseDepth(),
  },
]

const blockItems: MenuItemData[] = [
  {
    icon: Icon.Normal,
    title: t("normal"),
    hotkey: "mod+alt+0",
    action: (editor) => editor.collapsibleParagraph.convertParagraph(),
  },
  {
    icon: Icon.H1,
    title: t("heading1"),
    hotkey: "mod+alt+1",
    action: (editor) => editor.heading.convertHeading(1, true),
    active: (editor) => editor.heading.isHeadingActive(1),
  },
  {
    icon: Icon.H2,
    title: t("heading2"),
    hotkey: "mod+alt+2",
    action: (editor) => editor.heading.convertHeading(2, true),
    active: (editor) => editor.heading.isHeadingActive(2),
  },
  {
    icon: Icon.H3,
    title: t("heading3"),
    hotkey: "mod+alt+3",
    action: (editor) => editor.heading.convertHeading(3, true),
    active: (editor) => editor.heading.isHeadingActive(3),
  },
]

for (const level of [4, 5] as const) {
  blockItems.push({
    icon: level === 4 ? Icon.H4 : Icon.H5,
    title: t(level === 4 ? 'heading4' : 'heading5'),
    hotkey: `mod+alt+${level}`,
    action: editor => editor.heading.convertHeading(level, true),
    active: editor => editor.heading.isHeadingActive(level),
  })
}

export const expandedBlockItems: MenuItemData[] = [...blockItems]

export const compactBlockItems: MenuItemData[] = [
  {
    icon: Icon.H,
    title: t("paragraphStyle"),
    more: true,
    children: blockItems,
  }
]

// Export listDepthItems so they can be used in list-items.tsx
export { listDepthItems }
