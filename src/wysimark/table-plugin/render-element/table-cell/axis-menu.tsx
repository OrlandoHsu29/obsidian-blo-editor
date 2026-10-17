import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { Editor, Transforms } from 'slate'
import { Menu } from 'obsidian'
import { ui } from '../../../utils/translations'
import { BarsIcon } from '../../icons'
import { TableCellElement } from '../../types'
import { $ColumnMenu, $ColumnMenuTile, $RowMenu, $RowMenuTile } from '../styles'
const activeMenus=new WeakMap<Editor,()=>void>()

export function AxisMenu({cellElement,axis}:{cellElement:TableCellElement;axis:'row'|'column'}) {
  const editor=useSlateStatic(),ref=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
  const [position,setPosition]=useState<{left:number;top:number}|null>(null)
  const dismiss=useCallback(()=>{clearTimeout(timer.current);setPosition(null);if(activeMenus.get(editor)===dismiss)activeMenus.delete(editor)},[editor])
  const Container=axis==='row'?$RowMenu:$ColumnMenu,Tile=axis==='row'?$RowMenuTile:$ColumnMenuTile
  const keep=()=>{clearTimeout(timer.current)}
  const close=()=>{keep();timer.current=setTimeout(dismiss,120)}
  useEffect(()=>()=>{clearTimeout(timer.current);if(activeMenus.get(editor)===dismiss)activeMenus.delete(editor)},[editor,dismiss])
  const open=()=>{
    activeMenus.get(editor)?.();activeMenus.set(editor,dismiss)
    keep();const tile=ref.current?.querySelector('.--tile');if(!tile)return
    const rect=tile.getBoundingClientRect(),width=axis==='row'?34:92,height=axis==='row'?86:34
    const left=axis==='row'?rect.left-width-6:rect.left+rect.width/2-width/2
    const top=axis==='row'?rect.top+rect.height/2-height/2:rect.top-height-6
    setPosition({left:Math.max(8,Math.min(window.innerWidth-width-8,left)),top:Math.max(8,Math.min(window.innerHeight-height-8,top))})
  }
  const action=(kind:'before'|'remove'|'after')=>{
    const options={at:cellElement,...(kind==='after'?{offset:1 as const}:{})}
    if(axis==='row')kind==='remove'?editor.tablePlugin.removeRow(options):editor.tablePlugin.insertRow(options)
    else kind==='remove'?editor.tablePlugin.removeColumn(options):editor.tablePlugin.insertColumn(options)
    dismiss()
  }
  const align=()=>{
    if(axis!=='column')return
    const menu=new Menu()
    for(const [value,label] of [['left','左对齐'],['center','居中对齐'],['right','右对齐']] as const)
      menu.addItem(item=>item.setTitle(ui(label)).onClick(()=>{
        Transforms.select(editor,Editor.start(editor,ReactEditor.findPath(editor,cellElement)))
        editor.tablePlugin.setTableColumnAlign({align:value})
      }))
    const rect=ref.current!.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom})
  }
  return <Container ref={ref} data-table-axis={axis} contentEditable={false} onMouseEnter={open} onMouseLeave={close} onMouseDown={event=>event.preventDefault()} onClick={align}>
    <Tile className="--tile"><BarsIcon /></Tile>
    {position&&createPortal(<div className="wysimark-overlay wysimark-table-actions" data-table-action-axis={axis} style={{position:'fixed',...position}} onMouseEnter={keep} onMouseLeave={close}>
      {(['before','remove','after'] as const).map(kind=><button key={kind} aria-label={ui(axis==='row'?(kind==='remove'?'删除行':kind==='before'?'上方插入行':'下方插入行'):(kind==='remove'?'删除列':kind==='before'?'左侧插入列':'右侧插入列'))} onMouseDown={event=>{event.preventDefault();event.stopPropagation();action(kind)}}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14"/>{kind!=='remove'&&<path d="M12 5v14"/>}</svg>
      </button>)}
    </div>,document.body)}
  </Container>
}
