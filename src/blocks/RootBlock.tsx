import { ui } from "../wysimark/utils/translations"
import { useRef, useState } from 'react'
import { Menu } from 'obsidian'
import { Element } from 'slate'
import { ReactEditor, useReadOnly, useSlateStatic } from 'slate-react'
import { blockDepth, changeBlockIndent, isEditorSpacer, isListBlock, moveBlockGroup, rootCache } from './model'
import type { Editor } from 'slate'
import { useFirstLineAlignment } from './first-line-alignment'
import { blockGap } from './typography'
import { selectBlockContents } from './selection'

const dragging=new WeakMap<Editor,Element>()
export function RootBlock({element,children}:{element:Element;children:React.ReactNode}) {
  const editor=useSlateStatic(),readOnly=useReadOnly(),index=rootCache(editor).indices.get(element),depth=blockDepth(element)
  const [drop,setDrop]=useState<'before'|'inside'|'after'|null>(null)
  const ref=useRef<HTMLDivElement>(null)
  const alignHandle=useFirstLineAlignment(ref,'--wysimark-handle-center',true,index!==undefined&&!isEditorSpacer(element))
  if(index===undefined||isEditorSpacer(element))return <>{children}</>
  const position=(event:React.DragEvent)=>{const rect=event.currentTarget.getBoundingClientRect(),fraction=(event.clientY-rect.top)/Math.max(1,rect.height);return fraction<.25?'before':fraction>.75?'after':'inside'}
  const menu=(event:React.MouseEvent)=>{
    event.preventDefault();event.stopPropagation()
    const items=new Menu()
    items.addItem(item=>item.setTitle(ui("缩进为子块")).setIcon('indent-increase').onClick(()=>changeBlockIndent(editor,index,1)))
    items.addItem(item=>item.setTitle(ui("减少缩进")).setIcon('indent-decrease').setDisabled(depth===0).onClick(()=>changeBlockIndent(editor,index,-1)))
    items.showAtMouseEvent(event.nativeEvent)
  }
  return <div ref={ref} data-wysimark-block data-block-type={element.type} data-block-depth={depth} data-subtitle={element.__subtitle||undefined} className={drop?`wysimark-block drop-${drop}`:'wysimark-block'} style={{position:'relative',marginLeft:isListBlock(element)?undefined:`${depth*2}em`,marginTop:blockGap(editor.children,index)}} onMouseEnter={alignHandle} onFocusCapture={alignHandle}
    onDragOver={event=>{if(dragging.has(editor)){event.preventDefault();event.stopPropagation();setDrop(position(event))}}}
    onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as globalThis.Node|null))setDrop(null)}}
    onDrop={event=>{const node=dragging.get(editor);if(!node)return;event.preventDefault();event.stopPropagation();const from=rootCache(editor).indices.get(node);if(from!==undefined&&moveBlockGroup(editor,from,index,position(event)))ReactEditor.focus(editor);dragging.delete(editor);setDrop(null)}}>
    {!readOnly&&<button className="wysimark-block-handle" contentEditable={false} draggable aria-label={ui("拖动整块及子块；点击选中，右键打开块菜单")} data-tooltip-position="right" onClick={event=>{event.preventDefault();event.stopPropagation();if(selectBlockContents(editor,index))ReactEditor.focus(editor)}} onContextMenu={menu}
      onDragStart={event=>{dragging.set(editor,element);event.dataTransfer.setData('application/x-wysimark-block',String(index));event.dataTransfer.effectAllowed='move';event.stopPropagation()}}
      onDragEnd={()=>{dragging.delete(editor);setDrop(null)}}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/></svg>
    </button>}
    {children}
  </div>
}
