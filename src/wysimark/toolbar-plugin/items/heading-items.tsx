import { headingListState } from '../../../blocks/heading-numbering'
import type { MenuItemData } from '../../shared-overlays'
import { ui } from '../../utils/translations'
import { MultilevelList } from '../icons'
import { HeadingListMenu } from '../components/dialog/heading-list-menu'

export const headingPrefixItem: Exclude<MenuItemData, 'divider'> = {
  title: ui('标题列表'), icon: MultilevelList, more: true,
  disabled: editor => editor.wysimark.readOnly || headingListState(editor).count === 0,
  Component: HeadingListMenu,
}
