import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'
import type { Editor, Element } from 'slate'
import { ReactEditor, useReadOnly } from 'slate-react'
import { isEditorSpacer } from './model'
import type { BlockDragGroup } from './model'
import { useBlockSelection } from './use-block-selection'
import { structuredBlockContent } from './structured-block'

function measureBlockHighlight(root:HTMLElement) {
    const content=root.querySelector<HTMLElement>('[data-slate-node="element"]')??root
    const structured=structuredBlockContent(root)
    // A block selection can notify React before Slate commits replacement nodes.
    // Measure the rendered leaves without resolving the pending model to DOM.
    const leaves=structured?[]:content.querySelectorAll('[data-slate-string],[data-slate-zero-width]')
    const range=root.ownerDocument.createRange()
    if(leaves.length){range.setStartBefore(leaves[0]);range.setEndAfter(leaves[leaves.length-1])}
    const rangeBounds=structured?.getBoundingClientRect()??(leaves.length?range.getBoundingClientRect():content.getBoundingClientRect())
    const bounds=rangeBounds.height?rangeBounds:content.getBoundingClientRect()
    const tableFrame=structured?.closest<HTMLElement>('.blo-table-frame')
    const clip=tableFrame?.getBoundingClientRect()
    const left=clip?Math.max(bounds.left,clip.left):bounds.left
    const right=clip?Math.min(bounds.right,clip.right):bounds.right
    const padding=clip?0:4
    const box=root.getBoundingClientRect(),scale=box.width&&root.offsetWidth?box.width/root.offsetWidth:1
    // Every background stays inside its own block, leaving a visible gap even
    // when adjacent list items have no paragraph spacing.
    const bottom=Math.max(1,box.height/scale-1)
    const top=Math.min(bottom,Math.max(1,(bounds.top-box.top)/scale-3))
    root.style.setProperty('--blo-highlight-left',`${(left-box.left)/scale-padding}px`)
    root.style.setProperty('--blo-highlight-top',`${top}px`)
    root.style.setProperty('--blo-highlight-width',`${Math.max(8,(right-left)/scale+padding*2)}px`)
    root.style.setProperty('--blo-highlight-height',`${Math.max(0,Math.min(bottom,(bounds.bottom-box.top)/scale+3)-top)}px`)
}
function clearBlockHighlight(root:HTMLElement) {
  if(root.matches('[data-block-dragging="true"],[data-block-selected="true"]'))return
  for(const name of ['left','top','width','height'])root.style.removeProperty(`--blo-highlight-${name}`)
}

/** Presentational feedback follows the rendered content without changing its layout. */
export function highlightBlockDrag(editor:Editor,group:BlockDragGroup,handleIndex=group.from) {
  const roots:HTMLElement[]=[]
  for(let index=group.from;index<group.end;index++) {
    const node=editor.children[index]
    if(isEditorSpacer(node))continue
    const root=ReactEditor.toDOMNode(editor,node).closest<HTMLElement>('[data-wysimark-block]')
    if(!root)continue
    measureBlockHighlight(root)
    root.setAttribute('data-block-dragging','true')
    if(index===handleIndex)root.setAttribute('data-block-drag-handle','true')
    roots.push(root)
  }
  return {
    start:()=>{for(const root of roots)root.setAttribute('data-block-drag-source','true')},
    clear:()=>{for(const root of roots){
      root.removeAttribute('data-block-drag-source')
      root.removeAttribute('data-block-dragging')
      root.removeAttribute('data-block-drag-handle')
      clearBlockHighlight(root)
    }},
  }
}

export function BlockHighlight({element,rootRef}:{element:Element;rootRef:RefObject<HTMLElement|null>}) {
  const readOnly=useReadOnly(),selected=useBlockSelection(element)
  useLayoutEffect(()=>{
    const root=rootRef.current
    if(!root||!selected||readOnly)return
    root.setAttribute('data-block-selected','true')
    const place=()=>measureBlockHighlight(root)
    place()
    const observer=new root.ownerDocument.defaultView!.ResizeObserver(place);observer.observe(root)
    return()=>{observer.disconnect();root.removeAttribute('data-block-selected');clearBlockHighlight(root)}
  },[element,rootRef,selected,readOnly])
  return <span className="wysimark-block-highlight" contentEditable={false} aria-hidden="true" />
}
