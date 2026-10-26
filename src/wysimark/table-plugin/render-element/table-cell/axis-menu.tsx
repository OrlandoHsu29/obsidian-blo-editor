import { useContext, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { ui } from '../../../utils/translations'
import { BarsIcon } from '../../icons'
import { TableCellElement } from '../../types'
import { $ColumnMenu, $ColumnMenuTile, $RowMenu, $RowMenuTile } from '../styles'
import { deleteSelectedTableAxis, selectTableAxis } from '../../cell-selection'
import { TableContext } from '../table-context'

export function AxisMenu({cellElement,axis}:{cellElement:TableCellElement;axis:'row'|'column'}) {
  const editor=useSlateStatic(),ref=useRef<HTMLDivElement>(null)
  const [position,setPosition]=useState<{left:number;top:number}|null>(null)
  const {cells,setDeletePreview}=useContext(TableContext)
  const active=cells?.axis===axis&&(axis==='row'?cells.top===cellElement.y:cells.left===cellElement.x)
  const Container=axis==='row'?$RowMenu:$ColumnMenu,Tile=axis==='row'?$RowMenuTile:$ColumnMenuTile
  useLayoutEffect(()=>{
    if(!active){setPosition(null);return}
    const tile=ref.current?.querySelector<HTMLElement>('.--tile');if(!tile)return
    const doc=tile.ownerDocument,win=doc.defaultView!
    const place=()=>{
      const rect=tile.getBoundingClientRect(),width=36,height=34
      // The row action sits just inside the table's left edge, above its row.
      const left=axis==='row'?rect.right+6:rect.left+rect.width/2-width/2
      const top=rect.top-height-6
      const next={left:Math.max(8,Math.min(win.innerWidth-width-8,left)),top:Math.max(8,Math.min(win.innerHeight-height-8,top))}
      setPosition(previous=>previous?.left===next.left&&previous?.top===next.top?previous:next)
    }
    place()
    doc.addEventListener('scroll',place,true);win.addEventListener('resize',place)
    const observer=new ResizeObserver(place);observer.observe(tile)
    return()=>{
      doc.removeEventListener('scroll',place,true);win.removeEventListener('resize',place);observer.disconnect()
      setDeletePreview?.(null)
    }
  },[active,axis,setDeletePreview])
  const select=()=>{
    selectTableAxis(editor,ReactEditor.findPath(editor,cellElement),axis)
    ReactEditor.focus(editor)
  }
  // Portal into the window that owns this cell; the quick memo panel is a popout.
  const hostDocument=ref.current?.ownerDocument??document
  return <Container ref={ref} data-table-axis={axis} contentEditable={false} onMouseDown={event=>{event.preventDefault();event.stopPropagation();select()}}>
    <Tile className="--tile"><BarsIcon /></Tile>
    {active&&position&&createPortal(<div className="wysimark-overlay wysimark-table-actions" data-table-action-axis={axis} style={{position:'fixed',...position}}>
      <button data-table-delete aria-label={ui(axis==='row'?'删除行':'删除列')}
        onMouseEnter={()=>{const path=ReactEditor.findPath(editor,cellElement);setDeletePreview?.({axis,index:path[path.length-(axis==='row'?2:1)]})}}
        onMouseLeave={()=>setDeletePreview?.(null)}
        onMouseDown={event=>{event.preventDefault();event.stopPropagation();select();deleteSelectedTableAxis(editor);setDeletePreview?.(null)}}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>
      </button>
    </div>,hostDocument.body)}
  </Container>
}
