import { MenuItemData } from "../../shared-overlays"

import { TableDialog } from "../components"
import { AnchorDialog, AttachmentInsertDialog } from "../components/dialog/anchor-dialog"
import * as Icon from "../icons"
import { t } from "../../utils/translations"

export const dialogItems: MenuItemData[] = [
  {
    icon: Icon.Link,
    title: t("insertLink"),
    more: true,
    hotkey: "mod+k",
    Component: AnchorDialog,
  },
  {
    icon: Icon.Attachment,
    title: t('insertAttachment'),
    more: true,
    Component: AttachmentInsertDialog,
  },
  {
    icon: Icon.Table,
    title: t("insertTable"),
    hotkey: "super+t",
    more: true,
    Component: TableDialog,
  },
  {
    icon: Icon.HorizontalRule,
    title: t("horizontalRule"),
    hotkey: "super+-",
    action: (editor) => editor.horizontalRule.insertHorizontalRule(),
  },
]

export const expandedDialogItems: MenuItemData[] = dialogItems

export const compactDialogItems: MenuItemData[] = dialogItems

export const smallDialogItems: MenuItemData[] = [
  {
    icon: Icon.Plus,
    title: t("insert"),
    more: true,
    children: dialogItems,
  },
]
