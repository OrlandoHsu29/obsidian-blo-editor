import { Editor, Element, Node, PathRef, Transforms } from 'slate'
import { blockDepth } from './model'

/** Headings may live in ordered lists, never in quotes or other list kinds. */
export function liftHeadingContainer(editor:Editor,ref:PathRef) {
 for(let i=0;i<32&&ref.current;i++) {
  const path=ref.current
  const quote=Editor.above(editor,{at:path,match:n=>Element.isElement(n)&&n.type==='block-quote'})
  const otherList=Editor.above(editor,{at:path,match:n=>Element.isElement(n)&&['unordered-list-item','task-list-item'].includes(n.type)})
  if(!quote&&!otherList)break
  const ordered=Editor.above(editor,{at:path,match:n=>Element.isElement(n)&&n.type==='ordered-list-item'})
  const lift=quote&&ordered&&ordered[1].length>quote[1].length?ordered[1]:path
  Transforms.liftNodes(editor,{at:lift})
 }
}

export function setHeadingNode(editor:Editor,path:number[],level:number|undefined) {
 const node=Node.get(editor,path)
 if(!Element.isElement(node))return
 const depth=blockDepth(node)
 Transforms.setNodes(editor,{type:level===undefined?'paragraph':'heading',...(level===undefined?{}:{level:level as 1|2|3|4|5|6}),__subtitle:undefined,...(node.__blockDepth!==undefined||depth>0?{__blockDepth:depth}:{})},{at:path})
 if(level===undefined)Transforms.unsetNodes(editor,'level',{at:path})
 Transforms.unsetNodes(editor,['depth','checked','start','__firstAtDepth','__numbering'],{at:path})
}
