import { ReactEditor, useSlateStatic } from 'slate-react'
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { MenuItemData } from '../../../shared-overlays/types'
import { toolbarItemLayout } from '../../items'
import { $Toolbar, $ToolbarContainer, $ToolbarDivider, $ToolbarDividerContainer } from '../../styles'
import { ToolbarButton } from './toolbar-button'
import { getDefaultIntegrations, subscribeDefaultIntegrations } from '../../../../integration-preferences'
import { t, ui } from '../../../utils/translations'
import { TablerIcon } from '../../../sink'
import { useLayer } from '../../../use-layer'
import { ToolbarOverflowMenu } from './overflow-menu'
import { useToolbarOverflow } from './use-toolbar-overflow'
import { useToolbarMotion } from './use-toolbar-motion'
import { toolbarIndices } from './fit-toolbar'
const MoreToolsIcon = () => <TablerIcon><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></TablerIcon>
function ToolbarItem({item, menuAnchor}:{item:MenuItemData; menuAnchor?: HTMLElement}) {
  const editor=useSlateStatic()
  if(item==='divider')return <$ToolbarDividerContainer data-item-type='divider'><$ToolbarDivider /></$ToolbarDividerContainer>
  if(item.show&&!item.show(editor))return null
  return <ToolbarButton item={item} menuAnchor={menuAnchor} />
}
export function Toolbar() {
  const editor=useSlateStatic()
  const toolbar=useRef<HTMLDivElement>(null)
  const more=useRef<HTMLDivElement>(null)
  const menuLayer=useLayer('menu')
  useEffect(()=>{
    const doc=toolbar.current?.ownerDocument
    if(!doc)return
    const openTool=(title:string)=>{
      if(editor.wysimark.readOnly)return
      const button=Array.from(toolbar.current?.querySelectorAll<HTMLElement>('[data-toolbar-title]')??[]).find(button=>button.dataset.toolbarTitle===title)
      button?.click()
    }
    const openLink=()=>openTool(t('insertLink'))
    editor.wysimark.openToolbarTool=openTool
    editor.wysimark.openLink=openLink
    const openReference=(event:KeyboardEvent)=>{
      if(editor.wysimark.handleCommandHotkey||event.key.toLowerCase()!=='k'||!(event.ctrlKey||event.metaKey)||event.shiftKey||event.altKey||event.isComposing||editor.wysimark.readOnly)return
      let editable:HTMLElement
      try{editable=ReactEditor.toDOMNode(editor,editor)}catch{return}
      if(!editable.contains(event.target as Node))return
      event.preventDefault();event.stopPropagation();openLink()
    }
    doc.addEventListener('keydown',openReference,true)
    return()=>{doc.removeEventListener('keydown',openReference,true);if(editor.wysimark.openLink===openLink)delete editor.wysimark.openLink;if(editor.wysimark.openToolbarTool===openTool)delete editor.wysimark.openToolbarTool}
  },[editor])
  const integrations=editor.wysimark.integrationPreferences
  const integrationState=useSyncExternalStore(integrations?.subscribe ?? subscribeDefaultIntegrations, integrations?.getSnapshot ?? getDefaultIntegrations)
  const { items, primaryCount, collapseOrder } = useMemo(() => toolbarItemLayout(item => !item.show || item.show(editor), editor.wysimark.memoPanel), [integrationState, editor, editor.wysimark.memoPanel])
  const visible=useToolbarOverflow(toolbar,items,!editor.wysimark.readOnly,menuLayer.close,primaryCount,collapseOrder)
  useToolbarMotion(toolbar,items,visible,!editor.wysimark.readOnly)
  const overflow=items.some((item,index)=>item!=='divider'&&!visible.has(index))
  const overflowItems=useMemo(()=>toolbarIndices(items,index=>!visible.has(index)).map(index=>items[index]),[items,visible])
  const moreItem=useMemo(() => ({title:ui('更多工具'),icon:MoreToolsIcon,
    Component:({dest,close}:{dest:HTMLElement;close:()=>void})=><ToolbarOverflowMenu dest={dest} items={overflowItems} close={close}/>
  }),[overflowItems])
  if(editor.wysimark.readOnly)return null
  return <$ToolbarContainer ref={toolbar} data-wysimark-toolbar><$Toolbar>
    {items.map((item,index)=>{
      const next=item==='divider'?items.slice(index+1).find(item=>item!=='divider'):undefined
      const key=item==='divider'?`divider:${next&&next!=='divider'?next.title:index}`:`item:${item.title}`
      return <div key={key} data-toolbar-index={index} data-toolbar-motion-key={key}
      className={`blo-toolbar-item${!visible.has(index)?' blo-toolbar-item-hidden':''}`} aria-hidden={!visible.has(index)||undefined} inert={!visible.has(index)||undefined}>
      <ToolbarItem item={item} menuAnchor={!visible.has(index)?more.current??undefined:undefined}/>
    </div>})}
    <div ref={more} data-toolbar-overflow-trigger data-toolbar-motion-key="overflow" className={`blo-toolbar-item${overflow?'':' blo-toolbar-item-hidden'}`} aria-hidden={!overflow||undefined} inert={!overflow||undefined}>
      <ToolbarButton item={moreItem} menuToggle/>
    </div>
  </$Toolbar></$ToolbarContainer>
}
