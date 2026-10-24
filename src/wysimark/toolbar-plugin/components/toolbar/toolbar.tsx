import { useSlateStatic } from 'slate-react'
import { useSyncExternalStore } from 'react'
import { MenuItemData } from '../../../shared-overlays/types'
import { visibleToolbarItems } from '../../items'
import { $Toolbar, $ToolbarContainer, $ToolbarDivider, $ToolbarDividerContainer } from '../../styles'
import { ToolbarButton } from './toolbar-button'
import { getDefaultIntegrations, subscribeDefaultIntegrations } from '../../../../integration-preferences'
function ToolbarItem({item}:{item:MenuItemData}) {
  const editor=useSlateStatic()
  if(item==='divider')return <$ToolbarDividerContainer data-item-type='divider'><$ToolbarDivider /></$ToolbarDividerContainer>
  if(item.show&&!item.show(editor))return null
  return <ToolbarButton item={item} />
}
const emptyHidden: readonly string[] = []
const getEmptyHidden = () => emptyHidden
const subscribeEmpty = () => () => {}
export function Toolbar() {
  const editor=useSlateStatic()
  const integrations=editor.wysimark.integrationPreferences
  useSyncExternalStore(integrations?.subscribe ?? subscribeDefaultIntegrations, integrations?.getSnapshot ?? getDefaultIntegrations)
  const preferences = editor.wysimark.toolbarPreferences
  const hidden = useSyncExternalStore(preferences?.subscribe ?? subscribeEmpty, preferences?.getSnapshot ?? getEmptyHidden, getEmptyHidden)
  const items = visibleToolbarItems(hidden, item => !item.show || item.show(editor))
  if(editor.wysimark.readOnly)return null
  return <$ToolbarContainer data-wysimark-toolbar><$Toolbar>{items.map((item,index)=><ToolbarItem key={item==='divider'?index:item.title} item={item}/>)}</$Toolbar></$ToolbarContainer>
}
