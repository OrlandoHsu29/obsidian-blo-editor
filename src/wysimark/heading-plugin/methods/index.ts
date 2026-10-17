import { Editor, Element, Node, Transforms } from "slate"
import { HistoryEditor } from 'slate-history'
import { rewrapElement } from '../../sink'

import { curryOne } from "../../sink"

import { HeadingElement } from "../types"
import { liftHeadingContainer, setHeadingNode } from '../../../blocks/heading-conversion'

function convertHeading(
  editor: Editor,
  level: 1 | 2 | 3 | 4 | 5 | 6,
  allowToggle: boolean
) {
  if(editor.wysimark.readOnly||!editor.selection)return
  const entries=[...Editor.nodes(editor,{match:n=>Element.isElement(n)&&editor.convertElement.isConvertibleElement(n),mode:'highest'})]
  const toggle=allowToggle&&entries.length>0&&entries.every(([n])=>Element.isElement(n)&&n.type==='heading'&&n.level===level)
  const run=()=>Editor.withoutNormalizing(editor,()=>{
    const refs=entries.map(([,path])=>Editor.pathRef(editor,path))
    try {
      for(const ref of refs)liftHeadingContainer(editor,ref)
      const current=refs.filter(ref=>ref.current).map(ref=>[Node.get(editor,ref.current!),ref.current!] as const)
      if(current.every(([n])=>Element.isElement(n)&&['heading','paragraph','ordered-list-item','unordered-list-item','task-list-item'].includes(n.type)&&!Node.string(n).includes('\n'))) {
        for(const [node,path] of current.reverse()) {
          if(Element.isElement(node)&&node.type==='ordered-list-item')rewrapElement<HeadingElement>(editor,{type:'heading',level},path)
          else setHeadingNode(editor,path,toggle?undefined:level)
        }
      } else editor.convertElement.convertElements<HeadingElement>(n=>n.type==='heading'&&n.level===level,{type:'heading',level},allowToggle)
    }finally{refs.forEach(ref=>ref.unref())}
  })
  if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,run);else run()

}

function isHeadingActive(editor:Editor,level:1|2|3|4|5|6) {
 return [...Editor.nodes(editor,{match:n=>Element.isElement(n)&&n.type==='heading'&&n.level===level})].length>0
}
export function createHeadingMethods(editor:Editor) {
 return {convertHeading:curryOne(convertHeading,editor),isHeadingActive:curryOne(isHeadingActive,editor)}
}

