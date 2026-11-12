import { Editor, Element, Transforms } from 'slate'
import type { Path } from 'slate'
import { withHistoryBatch } from '../wysimark/utils/with-history-batch'
import { blockDepth, canIndentBlock, reflowFollowingLists } from './model'
import { rewrapElement } from '../wysimark/sink'

type ListType = 'ordered-list-item'|'unordered-list-item'|'task-list-item'
const isContainer=(n: unknown)=>Element.isElement(n)&&'blockChildren' in n&&!!n.blockChildren&&n.type.endsWith('list-item')

/** Primitive shared by selection commands; callers own the undo batch. */
export function setListBlock(editor:Editor,node:Element,path:Path,type?:ListType) {
  if(!isContainer(node)) {
    rewrapElement(editor,()=>!type?{type:'paragraph',__blockDepth:blockDepth(node)}:{type,depth:blockDepth(node),...(type==='ordered-list-item'?{__numbering:'continue' as const}:{}),...(type==='task-list-item'?{checked:false}:{})},path)
  } else if(!type) {
    node.children.forEach((child,index)=>{
      if(Element.isElement(child))Transforms.setNodes(editor,{__blockDepth:canIndentBlock(child)?Math.max(blockDepth(node),blockDepth(child)):0},{at:[...path,index]})
    })
    Transforms.unwrapNodes(editor,{at:path})
  } else {
    Transforms.setNodes(editor,{type,...(type==='ordered-list-item'?{__numbering:'continue' as const}:{}),...(type==='task-list-item'?{checked:false}:{})},{at:path})
    if(type!=='task-list-item')Transforms.unsetNodes(editor,'checked',{at:path})
  }
  reflowFollowingLists(editor,path,blockDepth(node))
}

/** Change a containing list instead of adding another list inside its heading. */
export function convertContainingList(editor: Editor, type: ListType, toggle: boolean) {
  if (!editor.selection || editor.wysimark.readOnly) return false
  const lists = [...Editor.nodes(editor, {match: n => Element.isElement(n) && (isContainer(n)||editor.convertElement.isConvertibleElement(n)), mode:'highest'})]
  if (!lists.some(([n])=>isContainer(n))) return false
  const remove = toggle && lists.every(([n]) => Element.isElement(n) && n.type === type)
  withHistoryBatch(editor,()=>{
    for (const [node,path] of lists.reverse()) {
      if(Element.isElement(node))setListBlock(editor,node,path,remove?undefined:type)
    }
  })
  return true
}
