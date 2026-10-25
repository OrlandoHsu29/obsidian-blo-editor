import { Editor, Element, Node, Path, Range, Text, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { isEditorSpacer, isListBlock } from '../../blocks/model'
import { isStructuredBlock, selectStructuredBoundary } from '../../blocks/boundary'

/** Delete empty prose blocks, keeping list and structured-block deletion with their plugins. */
export function deleteEmptyBoundaryParagraph(editor: Editor, direction: 'backward' | 'forward'): boolean {
  if(editor.wysimark.readOnly || !editor.selection || !Range.isCollapsed(editor.selection))return false
  const entry=Editor.above(editor,{match:n=>Element.isElement(n)&&editor.convertElement.isConvertibleElement(n)&&!isListBlock(n)})
  if(!entry)return false
  const [paragraph,path]=entry
  if(!Element.isElement(paragraph)||('__collapsible' in paragraph&&paragraph.__collapsible)||!Array.from<Node>(paragraph.children).every(n=>Text.isText(n)&&n.text===''))return false
  if(direction==='backward'&&path.length===1&&path[0]===0) {
    const next=editor.children.findIndex((node,index)=>index>0&&!isEditorSpacer(node))
    if(next<0)return false
    const remove=()=>Editor.withoutNormalizing(editor,()=>{
      Transforms.removeNodes(editor,{at:path})
      Transforms.select(editor,Editor.start(editor,[next-1]))
    })
    if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,remove);else remove()
    return true
  }
  if(direction==='backward'&&path.length===1) {
    let previous=path[0]-1
    while(previous>=0&&isEditorSpacer(editor.children[previous]))previous--
    if(previous>=0&&isStructuredBlock(editor.children[previous])) {
      const remove=()=>Editor.withoutNormalizing(editor,()=>{
        // Merge with the empty navigation paragraph so redo also restores
        // the caret on that same Slate point, rather than the following text.
        const boundary=editor.children[path[0]-1]
        if(path[0]===previous+2&&isEditorSpacer(boundary)&&Element.isElement(boundary))editor.apply({
          type:'merge_node',path,position:boundary.children.length,properties:Node.extractProps(paragraph),
        })
        else Transforms.removeNodes(editor,{at:path})
        selectStructuredBoundary(editor,previous)
      })
      if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,remove);else remove()
      return true
    }
  }
  const parent=Node.parent(editor,path),index=path[path.length-1],previous=parent.children[index-1],next=parent.children[index+1]
  const protectedBlock=(n:Node|undefined)=>!!n&&Element.isElement(n)&&editor.isMaster(n)
  if(!protectedBlock(previous)&&!protectedBlock(next))return false
  const nextRef=next?Editor.pathRef(editor,Path.next(path)):null
  const previousRef=previous?Editor.pathRef(editor,Path.previous(path)):null
  const remove=()=>{
    // A merge into preceding text records the caret movement in the structural
    // operation, so undo/redo also restore the correct side of the boundary.
    if(previous&&!protectedBlock(previous)&&(direction==='backward'||protectedBlock(next))) {
      Transforms.mergeNodes(editor,{at:path})
      if(previousRef?.current)Transforms.select(editor,Editor.end(editor,previousRef.current))
      return
    }
    Transforms.removeNodes(editor,{at:path})
    // Backspace returns to the preceding text; Delete advances to the next
    // text. Neither may place the caret inside a table or code block.
    const after=nextRef?.current || (Node.has(editor,path)?path:null)
    const before=previousRef?.current
    const previousText=before&&!protectedBlock(Node.get(editor,before))?before:null
    const nextText=after&&!protectedBlock(Node.get(editor,after))?after:null
    if(direction==='backward'&&previousText)Transforms.select(editor,Editor.end(editor,previousText))
    else if(nextText)Transforms.select(editor,Editor.start(editor,nextText))
    else if(previousText)Transforms.select(editor,Editor.end(editor,previousText))
    else if(after||before)Transforms.select(editor,Editor.range(editor,(after||before)!))
  }
  try{if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,remove);else remove()}
  finally{nextRef?.unref();previousRef?.unref()}
  return true
}
