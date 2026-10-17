import { Descendant, Editor, Element, Range, Text, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { blockDepth } from './model'
export function exitEmptyQuote(editor:Editor):boolean {
 if(editor.wysimark.readOnly||!editor.selection||!Range.isCollapsed(editor.selection))return false
 const paragraph=Editor.above(editor,{match:n=>Element.isElement(n)&&n.type==='paragraph'})
 const quote=Editor.above(editor,{match:n=>Element.isElement(n)&&n.type==='block-quote'})
 if(!paragraph||!quote||!Element.isElement(paragraph[0])||!(paragraph[0].children as Descendant[]).every(n=>Text.isText(n)&&n.text===''))return false
 const depth=blockDepth(editor.children[editor.selection.anchor.path[0]])
 const run=()=>Editor.withoutNormalizing(editor,()=>{
  for(let i=0;i<32;i++) {
   const ancestor=Editor.above(editor,{match:n=>Element.isElement(n)&&n.type==='block-quote'})
   const current=Editor.above(editor,{match:n=>Element.isElement(n)&&n.type==='paragraph'})
   if(!ancestor||!current)break
   Transforms.liftNodes(editor,{at:current[1]})
  }
  if(editor.selection)Transforms.setNodes(editor,{__blockDepth:depth},{at:[editor.selection.anchor.path[0]]})
  editor.marksPlugin.removeMarks()
 })
 if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,run);else run()
 return true
}
