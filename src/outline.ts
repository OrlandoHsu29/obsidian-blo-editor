import type { ListItemCache, Plugin, TFile, View } from 'obsidian'
import { debounce } from 'obsidian'
import type { Editor } from 'slate'
import { Node } from 'slate'
import { rootCache } from './blocks/model'
import type { BlockHeading } from './blocks/model'
type Heading={level:number;heading?:string;__bloSourceHeading?:string;__bloHeadingIndex?:number}
type HeadingDom={heading:Heading;el?:HTMLElement}
type OutlineView=View & {
  file?:TFile;cachedFile?:unknown;cachedHeadingDom?:HeadingDom[];
  getHeadings?:()=>Heading[];requestUpdate?:(()=>void)&{cancel?:()=>void};update?:()=>void;
  getOwner?:()=>unknown;findActiveHeading?:(owner:unknown)=>unknown;setHighlightedItem?:(item:unknown)=>void
  searchQuery?:{query:string}|null;prevQuery?:string
}

/** Offset leading root groups for later shallower roots; keep native subtree depths. */
export function outlineIndentOffsets(headings:Heading[]):number[] {
  let rootLevel=Infinity,group=-1
  const groups=headings.map(heading=>{
    if(heading.level<rootLevel){rootLevel=heading.level;group++}
    return group
  })
  return groups.map(index=>group-index)
}

function applyOutlineIndent(nodes:HeadingDom[],headings:Heading[]) {
  const offsets=outlineIndentOffsets(headings)
  let rootLevel=Infinity
  nodes.forEach((node,index)=>{
    const root=headings[index].level<=rootLevel
    rootLevel=Math.min(rootLevel,headings[index].level)
    // Native items own their entire subtree, including guides and fold icons.
    // Offset only the root; all child layout stays under native control.
    if(root&&offsets[index]) {
      node.el?.setAttribute('data-blo-outline-root','')
      node.el?.style.setProperty('--blo-outline-root-offset',String(offsets[index]))
    } else {
      node.el?.removeAttribute('data-blo-outline-root')
      node.el?.style.removeProperty('--blo-outline-root-offset')
    }
  })
}

/** Decorate native input while retaining original source positions and cache objects. */
export function outlineHeadings(headings:Heading[],blocks?:BlockHeading[],listItems?:ListItemCache[]):Heading[] {
  const aligned=blocks?.length===headings.length&&headings.every((heading,index)=>{
    const node=blocks[index].node
    return node.type==='heading'&&node.level===heading.level
  })
  if(!blocks)return headings.filter(heading=>heading.level<=4)
  const plain=blocks.filter(block=>block.listIndex===undefined)
  const canMerge=!!listItems&&plain.length===headings.length&&plain.every((block,index)=>block.node.type==='heading'&&block.node.level===headings[index].level)&&
    blocks.every(block=>block.listIndex===undefined||!!listItems[block.listIndex])
  if(!aligned&&!canMerge)return headings.filter(heading=>heading.level<=4)
  let nativeIndex=0
  return blocks.flatMap((block,index)=>{
    const node=block.node
    if(node.type!=='heading')return []
    const source=aligned?headings[index]:block.listIndex===undefined?headings[nativeIndex++]:
      {heading:Node.string(node),level:node.level,position:listItems![block.listIndex].position}
    if(node.level>4)return []
    return [{...source,heading:block.numberLabel===undefined?source.heading:`${block.numberLabel} ${source.heading??''}`,
      __bloSourceHeading:Node.string(node),__bloHeadingIndex:index}]
  })
}
/** Reuse the editor's numbering projection, never scan or rewrite the virtual tree DOM. */
export function installOutlineFilter(plugin:Plugin,getEditor?:(file:unknown)=>Editor|undefined) {
  const patched=new Map<OutlineView,{original:()=>Heading[];wrapped:()=>Heading[];own:boolean;originalUpdate?:()=>void;wrappedUpdate?:()=>void;ownUpdate:boolean;originalRequest?:OutlineView['requestUpdate'];wrappedRequest?:OutlineView['requestUpdate'];ownRequest:boolean}>()
  const attach=()=>{
    for(const leaf of plugin.app.workspace.getLeavesOfType('outline')) {
      const view=leaf.view as OutlineView
      if(patched.has(view)||typeof view.getHeadings!=='function')continue
      const original=view.getHeadings,own=Object.prototype.hasOwnProperty.call(view,'getHeadings')
      const empty:Heading[]=[]
      let previous:Heading[]|undefined,previousBlocks:BlockHeading[]|undefined,previousItems:ListItemCache[]|undefined,filtered:Heading[]=[]
      const wrapped=function(this:OutlineView){
        const originalHeadings=original.call(this),headings=originalHeadings.length?originalHeadings:empty
        const editor=getEditor?.(this.file),cache=editor?rootCache(editor):undefined,blocks=cache?.headings
        const lists=this.file?plugin.app.metadataCache.getFileCache(this.file)?.listItems:undefined
        const items=cache&&lists?.length===cache.listCount?lists:undefined
        if(headings!==previous||blocks!==previousBlocks||items!==previousItems){previous=headings;previousBlocks=blocks;previousItems=items;filtered=outlineHeadings(headings,blocks,items)}
        return filtered
      }
      const originalUpdate=view.update,ownUpdate=Object.prototype.hasOwnProperty.call(view,'update')
      let styledNodes:HeadingDom[]|undefined
      const wrappedUpdate=originalUpdate&&function(this:OutlineView){
        const headings=this.getHeadings!(),nodes=this.cachedHeadingDom
        // Enter and list prefixes change source positions without changing the
        // outline tree. Refresh those references without clearing every child.
        if(this.file&&this.file===this.cachedFile&&(this.searchQuery?.query??'')===this.prevQuery&&nodes&&nodes.length===headings.length&&
          nodes.every((n,i)=>n.heading.level===headings[i].level&&n.heading.heading===headings[i].heading)) {
          nodes.forEach((node,i)=>{node.heading=headings[i]})
          if(styledNodes!==nodes){applyOutlineIndent(nodes,headings);styledNodes=nodes}
          this.setHighlightedItem?.(this.findActiveHeading?.(this.getOwner?.()))
          return
        }
        const result=originalUpdate.call(this)
        const rendered=this.cachedHeadingDom
        if(rendered?.length===headings.length){applyOutlineIndent(rendered,headings);styledNodes=rendered}
        return result
      }
      const originalRequest=view.requestUpdate,ownRequest=Object.prototype.hasOwnProperty.call(view,'requestUpdate')
      // Native requestUpdate captures the old update function in its constructor.
      // Route scheduled refreshes through the same wrapper as direct updates.
      const wrappedRequest=wrappedUpdate&&debounce(()=>view.update?.(),10)
      view.getHeadings=wrapped
      if(wrappedUpdate){originalRequest?.cancel?.();view.update=wrappedUpdate;view.requestUpdate=wrappedRequest}
      patched.set(view,{original,wrapped,own,originalUpdate,wrappedUpdate,ownUpdate,originalRequest,wrappedRequest,ownRequest});view.requestUpdate?.()
    }
  }
  plugin.app.workspace.onLayoutReady(attach)
  plugin.registerEvent(plugin.app.workspace.on('layout-change',attach))
  plugin.register(()=>{
    for(const [view,{original,wrapped,own,originalUpdate,wrappedUpdate,ownUpdate,originalRequest,wrappedRequest,ownRequest}] of patched) {
      if(wrappedRequest&&view.requestUpdate===wrappedRequest){wrappedRequest.cancel?.();if(ownRequest)view.requestUpdate=originalRequest;else delete view.requestUpdate}
      for(const node of view.cachedHeadingDom??[]){
        node.el?.removeAttribute('data-blo-outline-root')
        node.el?.style.removeProperty('--blo-outline-root-offset')
      }
      if(wrappedUpdate&&view.update===wrappedUpdate){if(ownUpdate)view.update=originalUpdate;else delete view.update}
      if(view.getHeadings===wrapped){if(own)view.getHeadings=original;else delete view.getHeadings;view.requestUpdate?.()}
    }
    patched.clear()
  })
}
