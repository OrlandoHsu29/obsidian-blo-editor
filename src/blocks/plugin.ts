import { createPlugin, TypedPlugin } from '../wysimark/sink'
import { isListBlock, normalizeHeadingIndent, normalizeOrderedText } from './model'
import { cleanPastedFragment } from './typography'
import { Editor, Element, Node, Range, Text, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import type { Descendant } from 'slate'
import { clearBlockSelection, deleteAtBlockBoundary, deleteWholeBlockSelection, indentBlockSelection, isBlockSelectionRange, isWholeBlockSelected, navigateBlockBoundary } from './selection'
import { indentCodeSelection } from '../wysimark/code-block-plugin/methods/indent-selection'
import { boundaryBlockIndex, insertBreakAtBoundary, materializeTextBoundary, normalizeStructuredBoundary } from './boundary'
import { handleTableCellKey } from '../wysimark/table-plugin/cell-selection'
import { exitEmptyQuote } from './subtitle'
import { relocateFoldedSelection, revealFoldedSelection } from './folding'
import { uniquePastedBlockIds, validBlockId } from './block-reference'
type Types={Name:'block-structure';Editor:{}}
export const BlockStructurePlugin=createPlugin<Types>(editor=>{
 const {insertFragment,insertText}=editor
 const {apply}=editor
 editor.apply=operation=>{
  const restoring=HistoryEditor.isHistoryEditor(editor)&&HistoryEditor.isSaving(editor)===false
  if(!restoring&&operation.type==='split_node'&&operation.path.length===1&&'__blockId' in operation.properties&&validBlockId(operation.properties.__blockId)) {
   clearBlockSelection(editor)
   const node=Node.get(editor,operation.path)
   const emptyPrefix=operation.position===0||Element.isElement(node)&&
    (node.type==='paragraph'||node.type==='heading'||isListBlock(node))&&
    (node.children as Descendant[]).slice(0,operation.position).every(child=>Text.isText(child)&&child.text==='')
   if(emptyPrefix) {
    Editor.withoutNormalizing(editor,()=>{apply(operation);Transforms.unsetNodes(editor,'__blockId',{at:operation.path})})
   } else {
    const {__blockId,...properties}=operation.properties
    apply({...operation,properties})
   }
   return
  }
  if(operation.type==='set_selection'&&operation.newProperties) {
   const selection={...editor.selection,...operation.newProperties}
   if(Range.isRange(selection)&&!restoring&&!isBlockSelectionRange(editor,selection))revealFoldedSelection(editor,selection)
  }
  // Browser selectionchange may echo the exact range we just selected.
  // A mouse selection is cleared separately on pointer down.
  if(operation.type!=='set_selection'||!editor.selection||!operation.newProperties||
    !Range.equals(editor.selection,{...editor.selection,...operation.newProperties}))clearBlockSelection(editor)
  apply(operation)
  if(operation.type==='set_selection'&&restoring)relocateFoldedSelection(editor)
  if(operation.type==='set_node'&&'__collapsed' in operation.newProperties&&operation.newProperties.__collapsed===true)relocateFoldedSelection(editor)
 }
 editor.insertText=text=>{
  if(!text||boundaryBlockIndex(editor)===undefined)return insertText(text)
  Editor.withoutNormalizing(editor,()=>{materializeTextBoundary(editor);insertText(text)})
 }
 editor.insertFragment=(fragment,options)=>{
  const insert=()=>insertFragment(uniquePastedBlockIds(editor,cleanPastedFragment(fragment as Descendant[])),options)
  if(!fragment.length||boundaryBlockIndex(editor)===undefined)return insert()
  Editor.withoutNormalizing(editor,()=>{materializeTextBoundary(editor);insert()})
 }
 return {
 name:'block-structure',editor:{
  normalizeNode:entry=>normalizeHeadingIndent(editor,entry)||normalizeStructuredBoundary(editor,entry)||normalizeOrderedText(editor,entry),
  insertBreak:()=>insertBreakAtBoundary(editor)||exitEmptyQuote(editor),
  deleteBackward:()=>deleteAtBlockBoundary(editor),
  deleteForward:()=>deleteWholeBlockSelection(editor),
  deleteFragment:()=>deleteWholeBlockSelection(editor),
 },
 editableProps:{onKeyDown:event=>{
  if(handleTableCellKey(editor,event)){event.preventDefault();event.stopPropagation();return true}
  if(navigateBlockBoundary(editor,event)){event.preventDefault();event.stopPropagation();return true}
  if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey||event.nativeEvent?.isComposing)return false
  const delta=event.shiftKey?-1:1
  const whole=editor.selection&&isWholeBlockSelected(editor,editor.selection.anchor.path[0])
  const textHandled=!whole&&indentCodeSelection(editor,delta)
  if(!textHandled&&!indentBlockSelection(editor,delta))return false
  event.preventDefault();event.stopPropagation();return true
 }},
}}) as TypedPlugin<Types>
