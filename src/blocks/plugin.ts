import { createPlugin, TypedPlugin } from '../wysimark/sink'
import { isListBlock, normalizeHeadingIndent, normalizeOrderedText } from './model'
import { cleanPastedFragment } from './typography'
import { Editor, Element, Node, Range, Text, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import type { Descendant } from 'slate'
import { clearBlockSelection, deleteAtBlockBoundary, deleteImageRowAtCaret, deleteWholeBlockSelection, indentBlockSelection, isBlockSelectionRange, isWholeBlockSelected, navigateBlockBoundary, restoreBlockSelectionOnUndo, selectedImageFragment } from './selection'
import { indentCodeSelection } from '../wysimark/code-block-plugin/methods/indent-selection'
import { indentQuoteContents } from './quote-indent'
import { boundaryBlockIndex, deleteRangeEndingAtBoundary, insertBreakAtBoundary, materializeTextBoundary, normalizeStructuredBoundary, outdentEmptyParagraph, selectStructuredBoundary } from './boundary'
import { handleTableCellKey } from '../wysimark/table-plugin/cell-selection'
import { exitEmptyQuote } from './subtitle'
import { relocateFoldedSelection, revealFoldedSelection } from './folding'
import { uniquePastedBlockIds, validBlockId } from './block-reference'
import { headingDefaults } from './heading-defaults'
import type { HeadingDefaults } from './heading-defaults'
import { copiedTextContent, pasteTextContent } from './paste-style'
import { activeImageRow, imageRowAtBoundary, imagesForRow, insertImageRow, preserveImageRowSizesOnRemoval, splitImageRowAtCaret } from './image-row'
import { normalizeNode as normalizeImageRow } from '../wysimark/image-plugin/normalize-node'
type Types={Name:'block-structure';Editor:{}}
export const BlockStructurePlugin=createPlugin<Types>(editor=>{
 restoreBlockSelectionOnUndo(editor)
 const {insertFragment,insertText,getFragment}=editor
 editor.getFragment=()=>copiedTextContent(editor,selectedImageFragment(editor)??getFragment())
 const {apply}=editor
 let pendingDefaults:HeadingDefaults|undefined
 editor.apply=operation=>{
  const restoring=HistoryEditor.isHistoryEditor(editor)&&HistoryEditor.isSaving(editor)===false
  const rootChange=!restoring&&['insert_node','remove_node','move_node','merge_node','split_node'].includes(operation.type)&&'path' in operation&&operation.path.length===1
  const defaults=rootChange?headingDefaults(editor.children[0])??pendingDefaults:undefined
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
  if(!restoring&&operation.type==='remove_node'&&operation.path.length===2) {
   preserveImageRowSizesOnRemoval(editor,operation.path,()=>apply(operation))
  }else apply(operation)
  if(rootChange&&defaults) {
   const first=editor.children[0]
   if(Element.isElement(first)) {
    pendingDefaults=undefined
    if(headingDefaults(first)!==defaults)Transforms.setNodes(editor,{__headingDefaults:defaults},{at:[0]})
   }else pendingDefaults=defaults
  }
  if(operation.type==='set_selection'&&restoring)relocateFoldedSelection(editor)
  if(operation.type==='set_node'&&'__collapsed' in operation.newProperties&&operation.newProperties.__collapsed===true)relocateFoldedSelection(editor)
 }
 editor.insertText=text=>{
  const row=activeImageRow(editor)?.index
  if(!text||boundaryBlockIndex(editor)===undefined&&row===undefined)return insertText(text)
  Editor.withoutNormalizing(editor,()=>{
   if(row!==undefined)selectStructuredBoundary(editor,row)
   materializeTextBoundary(editor);insertText(text)
  })
 }
 editor.insertFragment=(fragment,options)=>{
  const insert=()=>insertFragment(pasteTextContent(editor,uniquePastedBlockIds(editor,cleanPastedFragment(fragment as Descendant[]))),options)
  const row=activeImageRow(editor)
  const boundary=boundaryBlockIndex(editor)??row?.index
  if(!fragment.length||boundary===undefined || options?.at)return insert()
  const target=row?{index:row.index,slot:Math.ceil(row.child/2)}:imageRowAtBoundary(editor,boundary)
  const images=target&&imagesForRow(fragment as Descendant[])
  if(target&&images&&insertImageRow(editor,target,images))return
  Editor.withoutNormalizing(editor,()=>{
   if(row)selectStructuredBoundary(editor,row.index)
   materializeTextBoundary(editor);insert()
  })
 }
 return {
 name:'block-structure',editor:{
  normalizeNode:entry=>normalizeImageRow(editor,entry)||normalizeHeadingIndent(editor,entry)||normalizeStructuredBoundary(editor,entry)||normalizeOrderedText(editor,entry),
  insertBreak:()=>{
   if(splitImageRowAtCaret(editor))return true
   const row=activeImageRow(editor)
   if(row)selectStructuredBoundary(editor,row.index)
   return insertBreakAtBoundary(editor)||outdentEmptyParagraph(editor)||exitEmptyQuote(editor)
  },
  deleteBackward:()=>deleteAtBlockBoundary(editor),
  deleteForward:()=>deleteWholeBlockSelection(editor)||deleteImageRowAtCaret(editor,1),
  deleteFragment:()=>deleteWholeBlockSelection(editor)||deleteRangeEndingAtBoundary(editor),
 },
 editableProps:{onCut:event=>{
  if((selectedImageFragment(editor)?.length??0)<=1)return false
  event.preventDefault();editor.setFragmentData(event.clipboardData,'cut');deleteWholeBlockSelection(editor);return true
 },onKeyDown:event=>{
  if(handleTableCellKey(editor,event)){event.preventDefault();event.stopPropagation();return true}
  if(navigateBlockBoundary(editor,event)){event.preventDefault();event.stopPropagation();return true}
  if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey||event.nativeEvent?.isComposing)return false
  const delta=event.shiftKey?-1:1
  const whole=editor.selection&&isWholeBlockSelected(editor,editor.selection.anchor.path[0])
  const textHandled=!whole&&(indentCodeSelection(editor,delta)||indentQuoteContents(editor,delta))
  if(!textHandled&&!indentBlockSelection(editor,delta))return false
  event.preventDefault();event.stopPropagation();return true
 }},
}}) as TypedPlugin<Types>
