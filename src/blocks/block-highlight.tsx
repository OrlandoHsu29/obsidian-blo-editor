import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'
import { Editor, Element } from 'slate'
import { ReactEditor, useReadOnly, useSlateStatic } from 'slate-react'
import { isEditorSpacer, rootCache } from './model'
import type { BlockDragGroup } from './model'
import { useBlockSelection } from './use-block-selection'
import { structuredBlockContent } from './structured-block'

function measureBlockHighlight(editor:Editor,index:number,root:HTMLElement) {
    const node=editor.children[index]
    const content=ReactEditor.toDOMNode(editor,node)
    const structured=structuredBlockContent(root)
    const rangeBounds=structured?.getBoundingClientRect()??ReactEditor.toDOMRange(editor,Editor.range(editor,[index])).getBoundingClientRect()
    const bounds=rangeBounds.height?rangeBounds:content.getBoundingClientRect()
    const box=root.getBoundingClientRect(),scale=box.width&&root.offsetWidth?box.width/root.offsetWidth:1
    // Every background stays inside its own block, leaving a visible gap even
    // when adjacent list items have no paragraph spacing.
    const bottom=Math.max(1,box.height/scale-1)
    const top=Math.min(bottom,Math.max(1,(bounds.top-box.top)/scale-3))
    root.style.setProperty('--blo-highlight-left',`${(bounds.left-box.left)/scale-4}px`)
    root.style.setProperty('--blo-highlight-top',`${top}px`)
    root.style.setProperty('--blo-highlight-width',`${Math.max(8,bounds.width/scale+8)}px`)
    root.style.setProperty('--blo-highlight-height',`${Math.max(0,Math.min(bottom,(bounds.bottom-box.top)/scale+3)-top)}px`)
}
function clearBlockHighlight(root:HTMLElement) {
  if(root.matches('[data-block-dragging="true"],[data-block-selected="true"]'))return
  for(const name of ['left','top','width','height'])root.style.removeProperty(`--blo-highlight-${name}`)
}

/** Presentational feedback follows the rendered content without changing its layout. */
export function highlightBlockDrag(editor:Editor,group:BlockDragGroup) {
  const roots:HTMLElement[]=[]
  for(let index=group.from;index<group.end;index++) {
    const node=editor.children[index]
    if(isEditorSpacer(node))continue
    const root=ReactEditor.toDOMNode(editor,node).closest<HTMLElement>('[data-wysimark-block]')
    if(!root)continue
    measureBlockHighlight(editor,index,root)
    root.setAttribute('data-block-dragging','true')
    roots.push(root)
  }
  return {
    start:()=>{for(const root of roots)root.setAttribute('data-block-drag-source','true')},
    clear:()=>{for(const root of roots){
      root.removeAttribute('data-block-drag-source')
      root.removeAttribute('data-block-dragging')
      clearBlockHighlight(root)
    }},
  }
}

export function BlockHighlight({element,rootRef}:{element:Element;rootRef:RefObject<HTMLElement|null>}) {
  const editor=useSlateStatic(),readOnly=useReadOnly(),selected=useBlockSelection(element)
  useLayoutEffect(()=>{
    const root=rootRef.current
    if(!root||!selected||readOnly)return
    root.setAttribute('data-block-selected','true')
    const place=()=>{const index=rootCache(editor).indices.get(element);if(index!==undefined)measureBlockHighlight(editor,index,root)}
    place()
    const observer=new ResizeObserver(place);observer.observe(root)
    return()=>{observer.disconnect();root.removeAttribute('data-block-selected');clearBlockHighlight(root)}
  },[editor,element,rootRef,selected,readOnly])
  return <span className="wysimark-block-highlight" contentEditable={false} aria-hidden="true" />
}
