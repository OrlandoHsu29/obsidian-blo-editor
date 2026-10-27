import { ReactEditor, useSlateStatic } from 'slate-react'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { MenuItemData } from '../../../shared-overlays/types'
import { visibleToolbarItems } from '../../items'
import { $Toolbar, $ToolbarContainer, $ToolbarDivider, $ToolbarDividerContainer } from '../../styles'
import { ToolbarButton } from './toolbar-button'
import { getDefaultIntegrations, subscribeDefaultIntegrations } from '../../../../integration-preferences'
import { t } from '../../../utils/translations'
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
  const toolbar=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const doc=toolbar.current?.ownerDocument
    if(!doc)return
    const openReference=(event:KeyboardEvent)=>{
      if(event.key.toLowerCase()!=='k'||!(event.ctrlKey||event.metaKey)||event.shiftKey||event.altKey||event.isComposing||editor.wysimark.readOnly)return
      let editable:HTMLElement
      try{editable=ReactEditor.toDOMNode(editor,editor)}catch{return}
      if(!editable.contains(event.target as Node))return
      const button=Array.from(toolbar.current?.querySelectorAll<HTMLElement>('[data-toolbar-title]')??[]).find(button=>button.dataset.toolbarTitle===t('insertLink'))
      if(!button)return
      event.preventDefault();event.stopPropagation();button.click()
    }
    doc.addEventListener('keydown',openReference,true)
    return()=>doc.removeEventListener('keydown',openReference,true)
  },[editor])
  const integrations=editor.wysimark.integrationPreferences
  useSyncExternalStore(integrations?.subscribe ?? subscribeDefaultIntegrations, integrations?.getSnapshot ?? getDefaultIntegrations)
  const preferences = editor.wysimark.toolbarPreferences
  const hidden = useSyncExternalStore(preferences?.subscribe ?? subscribeEmpty, preferences?.getSnapshot ?? getEmptyHidden, getEmptyHidden)
  const items = visibleToolbarItems(hidden, item => !item.show || item.show(editor), editor.wysimark.memoPanel)
  if(editor.wysimark.readOnly)return null
  return <$ToolbarContainer ref={toolbar} data-wysimark-toolbar><$Toolbar>{items.map((item,index)=><ToolbarItem key={item==='divider'?index:item.title} item={item}/>)}</$Toolbar></$ToolbarContainer>
}
