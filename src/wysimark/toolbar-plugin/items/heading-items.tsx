import type { MenuItemData } from '../../shared-overlays'
import { ui } from '../../utils/translations'
import { MultilevelList } from '../icons'
import { HeadingListMenu } from '../components/dialog/heading-list-menu'

export const headingPrefixItem: Exclude<MenuItemData, 'divider'> = {
  title: ui('标题列表'), icon: MultilevelList, more: true,
  disabled: editor => editor.wysimark.readOnly,
  Component: HeadingListMenu,
}
