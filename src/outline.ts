import type { Plugin, View } from 'obsidian'
type Heading={level:number;heading?:string}
type OutlineView=View & {
  file?:unknown;cachedFile?:unknown;cachedHeadingDom?:{heading:Heading}[];
  getHeadings?:()=>Heading[];requestUpdate?:()=>void;update?:()=>void;
  getOwner?:()=>unknown;findActiveHeading?:(owner:unknown)=>unknown;setHighlightedItem?:(item:unknown)=>void
}

/** Filter native outline input, never its virtual tree's DOM nodes. */
export function installOutlineFilter(plugin:Plugin) {
  const patched=new Map<OutlineView,{original:()=>Heading[];wrapped:()=>Heading[];own:boolean;originalUpdate?:()=>void;wrappedUpdate?:()=>void;ownUpdate:boolean}>()
  const attach=()=>{
    for(const leaf of plugin.app.workspace.getLeavesOfType('outline')) {
      const view=leaf.view as OutlineView
      if(patched.has(view)||typeof view.getHeadings!=='function')continue
      const original=view.getHeadings,own=Object.prototype.hasOwnProperty.call(view,'getHeadings')
      let previous:Heading[]|undefined,filtered:Heading[]=[]
      const wrapped=function(this:OutlineView){
        const headings=original.call(this)
        if(headings!==previous){previous=headings;filtered=headings.filter(h=>h.level<=4)}
        return filtered
      }
      const originalUpdate=view.update,ownUpdate=Object.prototype.hasOwnProperty.call(view,'update')
      const wrappedUpdate=originalUpdate&&function(this:OutlineView){
        const headings=this.getHeadings!(),nodes=this.cachedHeadingDom
        // Enter and list prefixes change source positions without changing the
        // outline tree. Refresh those references without clearing every child.
        if(this.file&&this.file===this.cachedFile&&nodes&&nodes.length===headings.length&&
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
