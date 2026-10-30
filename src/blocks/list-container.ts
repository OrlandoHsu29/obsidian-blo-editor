import { Editor, Element, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { blockDepth, reflowFollowingLists } from './model'
import { rewrapElement } from '../wysimark/sink'

/** Change a containing list instead of adding another list inside its heading. */
export function convertContainingList(editor: Editor, type: 'ordered-list-item'|'unordered-list-item'|'task-list-item', toggle: boolean) {
  if (!editor.selection || editor.wysimark.readOnly) return false
  const isContainer=(n: unknown)=>Element.isElement(n)&&'blockChildren' in n&&!!n.blockChildren&&n.type.endsWith('list-item')
  const lists = [...Editor.nodes(editor, {match: n => Element.isElement(n) && (isContainer(n)||editor.convertElement.isConvertibleElement(n)), mode:'highest'})]
  if (!lists.some(([n])=>isContainer(n))) return false
  const remove = toggle && lists.every(([n]) => Element.isElement(n) && n.type === type)
  const run=()=>Editor.withoutNormalizing(editor,()=>{
    for (const [node,path] of lists.reverse()) {
      if(!isContainer(node)) {
        rewrapElement(editor,()=>remove?{type:'paragraph',__blockDepth:blockDepth(node)}:{type,depth:blockDepth(node),...(type==='ordered-list-item'?{__numbering:'continue' as const}:{}),...(type==='task-list-item'?{checked:false}:{})},path)
      } else if(remove) {
        if(Element.isElement(node))node.children.forEach((child,index)=>{
          if(Element.isElement(child))Transforms.setNodes(editor,{__blockDepth:Math.max(blockDepth(node),blockDepth(child))},{at:[...path,index]})
        })
        Transforms.unwrapNodes(editor,{at:path})
      }
      else {
        Transforms.setNodes(editor,{type,...(type==='ordered-list-item'?{__numbering:'continue' as const}:{}),...(type==='task-list-item'?{checked:false}:{})},{at:path})
        if(type!=='task-list-item')Transforms.unsetNodes(editor,'checked',{at:path})
      }
      reflowFollowingLists(editor,path,blockDepth(node))
    }
  })
  if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,run);else run()
  return true
}
