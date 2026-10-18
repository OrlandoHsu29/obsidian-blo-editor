import type { ListItemCache, Plugin, TFile, View } from 'obsidian'
import type { Editor } from 'slate'
import { Node } from 'slate'
import { rootCache } from './blocks/model'
import type { BlockHeading } from './blocks/model'
type Heading={level:number;heading?:string;__bloSourceHeading?:string;__bloHeadingIndex?:number}
type OutlineView=View & {
  file?:TFile;cachedFile?:unknown;cachedHeadingDom?:{heading:Heading}[];
  getHeadings?:()=>Heading[];requestUpdate?:()=>void;update?:()=>void;
  getOwner?:()=>unknown;findActiveHeading?:(owner:unknown)=>unknown;setHighlightedItem?:(item:unknown)=>void
  searchQuery?:{query:string}|null;prevQuery?:string
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
  const patched=new Map<OutlineView,{original:()=>Heading[];wrapped:()=>Heading[];own:boolean;originalUpdate?:()=>void;wrappedUpdate?:()=>void;ownUpdate:boolean}>()
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
      const wrappedUpdate=originalUpdate&&function(this:OutlineView){
        const headings=this.getHeadings!(),nodes=this.cachedHeadingDom
        // Enter and list prefixes change source positions without changing the
        // outline tree. Refresh those references without clearing every child.
        if(this.file&&this.file===this.cachedFile&&(this.searchQuery?.query??'')===this.prevQuery&&nodes&&nodes.length===headings.length&&
          nodes.every((n,i)=>n.heading.level===headings[i].level&&n.heading.heading===headings[i].heading)) {
          nodes.forEach((node,i)=>{node.heading=headings[i]})
          this.setHighlightedItem?.(this.findActiveHeading?.(this.getOwner?.()))
          return
        }
        return originalUpdate.call(this)
      }
      view.getHeadings=wrapped;if(wrappedUpdate)view.update=wrappedUpdate
      patched.set(view,{original,wrapped,own,originalUpdate,wrappedUpdate,ownUpdate});view.requestUpdate?.()
    }
  }
  plugin.app.workspace.onLayoutReady(attach)
  plugin.registerEvent(plugin.app.workspace.on('layout-change',attach))
  plugin.register(()=>{
    for(const [view,{original,wrapped,own,originalUpdate,wrappedUpdate,ownUpdate}] of patched) {
      if(wrappedUpdate&&view.update===wrappedUpdate){if(ownUpdate)view.update=originalUpdate;else delete view.update}
      if(view.getHeadings===wrapped){if(own)view.getHeadings=original;else delete view.getHeadings;view.requestUpdate?.()}
    }
    patched.clear()
  })
}
