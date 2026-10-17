import { useSlateStatic } from 'slate-react'
import { MenuItemData } from '../../../shared-overlays/types'
import { items } from '../../items'
import { $Toolbar, $ToolbarContainer, $ToolbarDivider, $ToolbarDividerContainer } from '../../styles'
import { ToolbarButton } from './toolbar-button'
function ToolbarItem({item}:{item:MenuItemData}) {
  const editor=useSlateStatic()
  if(item==='divider')return <$ToolbarDividerContainer data-item-type='divider'><$ToolbarDivider /></$ToolbarDividerContainer>
  if(item.show&&!item.show(editor))return null
  return <ToolbarButton item={item} />
}
export function Toolbar() {
  const editor=useSlateStatic()
  if(editor.wysimark.readOnly)return null
  return <$ToolbarContainer data-wysimark-toolbar><$Toolbar>{items.map((item,index)=><ToolbarItem key={item==='divider'?index:item.title} item={item}/>)}</$Toolbar></$ToolbarContainer>
}
