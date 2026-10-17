import { RefObject, useCallback, useLayoutEffect } from 'react'

/** Ignore empty Slate boundary leaves and measure a real glyph on the first line. */
export function firstTextRect(root: HTMLElement): DOMRect | undefined {
  let first:DOMRect|undefined,largest:DOMRect|undefined
  for(const leaf of root.querySelectorAll<HTMLElement>('[data-slate-string]')) {
    const walker=root.ownerDocument.createTreeWalker(leaf,4)
    for(let text=walker.nextNode();text;text=walker.nextNode()) {
      const value=text.textContent||'',offset=value.search(/[^\s\u200b\ufeff]/u)
      if(offset<0)continue
      const range=root.ownerDocument.createRange();range.setStart(text,offset);range.setEnd(text,offset+(value.codePointAt(offset)!>0xffff?2:1))
      const rect=Array.from(range.getClientRects()).find(r=>r.width>0&&r.height>0)
      if(rect) {
        if(first&&rect.top>=first.bottom)return largest
        if(!first)first=rect
        if(rect.top<first.bottom&&rect.bottom>first.top&&(!largest||rect.height>largest.height))largest=rect
        break
      }
    }
  }
  if(largest)return largest
  // Empty paragraphs still have a caret line; hidden preview leaves do not.
  return Array.from(root.querySelectorAll<HTMLElement>('[data-slate-zero-width]')).map(leaf=>leaf.getBoundingClientRect()).find(rect=>rect.height>0)
}

type Target={variable:string;visibleOnly:boolean;inViewport?:boolean}
const documents=new WeakMap<Document,{add:(root:HTMLElement,target:Target)=>()=>void;schedule:(root:HTMLElement)=>void}>()
function measurements(root:HTMLElement,target:Target) {
  if(target.inViewport===false)return
  if(target.visibleOnly&&!root.matches(':hover,:focus-within'))return
  const text=firstTextRect(root);if(!text)return
  const rect=root.getBoundingClientRect(),style=getComputedStyle(root)
  // offsetWidth includes padding and borders; computed width needs the box model.
  const width=parseFloat(style.width)+(style.boxSizing==='border-box'?0:parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth))
  const scale=width>0?rect.width/width:1
  return `${(text.top+text.height/2-rect.top)/(scale||1)}px`
}
function registry(doc:Document) {
  let entry=documents.get(doc);if(entry)return entry
  const targets=new Map<HTMLElement,Target>(),pending=new Set<HTMLElement>(),win=doc.defaultView!;let frame=0
  const flush=()=>{frame=0;const updates=Array.from(pending,root=>({root,target:targets.get(root)})).filter(item=>item.target).map(({root,target})=>({root,target:target!,value:measurements(root,target!)}));pending.clear();for(const {root,target,value} of updates)if(value&&root.style.getPropertyValue(target.variable)!==value)root.style.setProperty(target.variable,value)}
  const schedule=(root:HTMLElement)=>{pending.add(root);if(!frame)frame=win.requestAnimationFrame(flush)}
  const refresh=()=>targets.forEach((_target,root)=>schedule(root))
  const observer=new win.ResizeObserver(entries=>entries.forEach(({target})=>schedule(target as HTMLElement)))
  const visibility=new win.IntersectionObserver(entries=>{
    for(const {target,isIntersecting}of entries){const config=targets.get(target as HTMLElement);if(!config)continue;config.inViewport=isIntersecting;if(isIntersecting)schedule(target as HTMLElement)}
  })
  const attach=()=>{win.addEventListener('resize',refresh);doc.fonts?.addEventListener('loadingdone',refresh)}
  const detach=()=>{win.removeEventListener('resize',refresh);doc.fonts?.removeEventListener('loadingdone',refresh);if(frame)win.cancelAnimationFrame(frame);frame=0;pending.clear()}
  entry={schedule,add:(root,target)=>{if(!targets.size)attach();target.inViewport=false;targets.set(root,target);observer.observe(root);visibility.observe(root);return()=>{observer.unobserve(root);visibility.unobserve(root);targets.delete(root);pending.delete(root);if(!targets.size)detach()}}};documents.set(doc,entry);return entry
}
export function useFirstLineAlignment(ref:RefObject<HTMLElement|null>,variable:string,visibleOnly=false,enabled=true) {
  const align=useCallback(()=>{const root=ref.current;if(!root)return;const value=measurements(root,{variable,visibleOnly:false});if(value)root.style.setProperty(variable,value)},[ref,variable])
  useLayoutEffect(()=>{const root=ref.current;if(enabled&&root)return registry(root.ownerDocument).add(root,{variable,visibleOnly})},[ref,variable,visibleOnly,enabled])
  // Content can change without resizing its block, such as deleting an empty leaf.
  useLayoutEffect(()=>{const root=ref.current;if(enabled&&root)registry(root.ownerDocument).schedule(root)})
  return align
}
