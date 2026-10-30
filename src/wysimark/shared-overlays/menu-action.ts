import type { Editor } from 'slate'
import { ReactEditor } from 'slate-react'
import type { MenuItemData } from './types'

/** Execute the same focus policy from toolbar buttons and menus. */
export function runMenuAction(item: Exclude<MenuItemData, 'divider'>, editor: Editor): boolean {
  if (!item.action || item.disabled?.(editor)) return false
  item.action(editor)
  if (item.focusEditor !== false) ReactEditor.focus(editor)
  return true
}
