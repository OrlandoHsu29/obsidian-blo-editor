import { useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { ui } from '../../../utils/translations'
import { BarsIcon } from '../../icons'
import { TableCellElement } from '../../types'
import { $ColumnMenu, $ColumnMenuTile, $RowMenu, $RowMenuTile } from '../styles'
import { deleteSelectedTableAxis, selectTableAxis } from '../../cell-selection'
import { TableContext } from '../table-context'
import { useBlockToolbarPosition } from '../../../use-reposition/hooks/use-block-toolbar-position'

export function AxisMenu({cellElement,axis}:{cellElement:TableCellElement;axis:'row'|'column'}) {
  const editor=useSlateStatic(),ref=useRef<HTMLDivElement>(null)
  const [tile,setTile]=useState<HTMLElement|null>(null)
  const action=useRef<HTMLDivElement>(null)
  const {cells,setDeletePreview}=useContext(TableContext)
  const active=cells?.axis===axis&&(axis==='row'?cells.top===cellElement.y:cells.left===cellElement.x)
  const Container=axis==='row'?$RowMenu:$ColumnMenu,Tile=axis==='row'?$RowMenuTile:$ColumnMenuTile
  useLayoutEffect(()=>{
    setTile(active?ref.current?.querySelector<HTMLElement>('.--tile')??null:null)
    return()=>setDeletePreview?.(null)
  },[active,setDeletePreview])
  const anchorRect=useCallback(()=>{
    const rect=tile!.getBoundingClientRect()
    return axis==='row'?{...rect.toJSON(),left:rect.right+6,right:rect.right+6,width:0}:rect
  },[tile,axis])
  const position=useBlockToolbarPosition(tile,action,{active,alignment:axis==='row'?'start':'center',aboveGap:6,belowGap:6,getAnchorRect:anchorRect,close:()=>setDeletePreview?.(null)})
  const select=()=>{
    selectTableAxis(editor,ReactEditor.findPath(editor,cellElement),axis)
    ReactEditor.focus(editor)
  }
  // Portal into the window that owns this cell; the quick memo panel is a popout.
  const hostDocument=ref.current?.ownerDocument??document
  return <Container ref={ref} data-table-axis={axis} contentEditable={false} onMouseDown={event=>{event.preventDefault();event.stopPropagation();select()}}>
    <Tile className="--tile"><BarsIcon /></Tile>
    {active&&tile&&createPortal(<div ref={action} className="wysimark-overlay wysimark-block-toolbar wysimark-table-actions" data-table-action-axis={axis}
      style={{position:'fixed',left:position.left,top:position.top,maxWidth:position.maxWidth,visibility:position.visible?'visible':'hidden',pointerEvents:position.visible?'auto':'none'}}>
      <button data-table-delete aria-label={ui(axis==='row'?'删除行':'删除列')}
        onMouseEnter={()=>{const path=ReactEditor.findPath(editor,cellElement);setDeletePreview?.({axis,index:path[path.length-(axis==='row'?2:1)]})}}
        onMouseLeave={()=>setDeletePreview?.(null)}
        onMouseDown={event=>{event.preventDefault();event.stopPropagation();select();deleteSelectedTableAxis(editor);setDeletePreview?.(null)}}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>
      </button>
    </div>,hostDocument.body)}
  </Container>
}
