import { ReactEditor, useSlateStatic } from 'slate-react'
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { MenuItemData } from '../../../shared-overlays/types'
import { visibleToolbarItems } from '../../items'
import { $Toolbar, $ToolbarContainer, $ToolbarDivider, $ToolbarDividerContainer } from '../../styles'
import { ToolbarButton } from './toolbar-button'
import { getDefaultIntegrations, subscribeDefaultIntegrations } from '../../../../integration-preferences'
import { t, ui } from '../../../utils/translations'
import { TablerIcon } from '../../../sink'
import { useLayer } from '../../../use-layer'
import { ToolbarOverflowMenu } from './overflow-menu'
import { useToolbarOverflow } from './use-toolbar-overflow'
const MoreToolsIcon = () => <TablerIcon><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></TablerIcon>
function ToolbarItem({item, menuAnchor}:{item:MenuItemData; menuAnchor?: HTMLElement}) {
  const editor=useSlateStatic()
  if(item==='divider')return <$ToolbarDividerContainer data-item-type='divider'><$ToolbarDivider /></$ToolbarDividerContainer>
  if(item.show&&!item.show(editor))return null
  return <ToolbarButton item={item} menuAnchor={menuAnchor} />
}
const emptyHidden: readonly string[] = []
const getEmptyHidden = () => emptyHidden
const subscribeEmpty = () => () => {}
export function Toolbar() {
  const editor=useSlateStatic()
  const toolbar=useRef<HTMLDivElement>(null)
  const more=useRef<HTMLDivElement>(null)
  const menuLayer=useLayer('menu')
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
  const integrationState=useSyncExternalStore(integrations?.subscribe ?? subscribeDefaultIntegrations, integrations?.getSnapshot ?? getDefaultIntegrations)
  const preferences = editor.wysimark.toolbarPreferences
  const hidden = useSyncExternalStore(preferences?.subscribe ?? subscribeEmpty, preferences?.getSnapshot ?? getEmptyHidden, getEmptyHidden)
  const items = useMemo(() => visibleToolbarItems(hidden, item => !item.show || item.show(editor), editor.wysimark.memoPanel), [hidden, integrationState, editor, editor.wysimark.memoPanel])
  const count=useToolbarOverflow(toolbar,items,!editor.wysimark.readOnly,menuLayer.close)
  const overflow=count<items.length
  const moreItem=useMemo(() => ({title:ui('更多工具'),icon:MoreToolsIcon,
    Component:({dest,close}:{dest:HTMLElement;close:()=>void})=><ToolbarOverflowMenu dest={dest} items={items.slice(count)} close={close}/>
  }),[items,count])
  if(editor.wysimark.readOnly)return null
  return <$ToolbarContainer ref={toolbar} data-wysimark-toolbar><$Toolbar>
    {items.map((item,index)=><div key={item==='divider'?index:item.title} data-toolbar-index={index}
      className={`blo-toolbar-item${index>=count?' blo-toolbar-item-hidden':''}`} aria-hidden={index>=count||undefined} inert={index>=count||undefined}>
      <ToolbarItem item={item} menuAnchor={index>=count?more.current??undefined:undefined}/>
    </div>)}
    <div ref={more} data-toolbar-overflow-trigger className={`blo-toolbar-item${overflow?'':' blo-toolbar-item-hidden'}`} aria-hidden={!overflow||undefined} inert={!overflow||undefined}>
      <ToolbarButton item={moreItem} menuToggle/>
    </div>
  </$Toolbar></$ToolbarContainer>
}
