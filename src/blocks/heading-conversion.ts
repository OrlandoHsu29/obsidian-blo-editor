import { Editor, Element, Node, PathRef, Transforms } from 'slate'
import { blockDepth } from './model'
import { setListBlock } from './list-container'

/** Detach heading-owned numbering without changing its text or attached blocks. */
export function unwrapHeadingList(editor:Editor,path:number[]):number[] {
 const parentPath=path.slice(0,-1)
 const parent=parentPath.length?Node.get(editor,parentPath):undefined
 if(!Element.isElement(parent)||parent.type!=='ordered-list-item'||!parent.blockChildren||path[path.length-1]!==0)return path
 const ref=Editor.pathRef(editor,path)
 try {setListBlock(editor,parent,parentPath);return ref.current!}
 finally {ref.unref()}
}

export function unwrapSelectedHeadingLists(editor:Editor):void {
 const headings=[...Editor.nodes(editor,{match:n=>Element.isElement(n)&&n.type==='heading'})]
 for(const [,path] of headings.reverse())unwrapHeadingList(editor,path)
}

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
 if(level===undefined)path=unwrapHeadingList(editor,path)
 const node=Node.get(editor,path)
 if(!Element.isElement(node))return
 const depth=level===undefined?blockDepth(node):0
 Transforms.setNodes(editor,{type:level===undefined?'paragraph':'heading',...(level===undefined?{}:{level:level as 1|2|3|4|5|6}),__subtitle:undefined,...(node.__blockDepth!==undefined||depth>0?{__blockDepth:depth}:{})},{at:path})
 if(level===undefined)Transforms.unsetNodes(editor,['level','__headingList'],{at:path})
 Transforms.unsetNodes(editor,['depth','checked','start','__firstAtDepth','__numbering'],{at:path})
}
