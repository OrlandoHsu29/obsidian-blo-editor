import { Editor, Element, Point, Range, Transforms } from 'slate'
import { blockDepth, changeBlockIndent, deleteBlockGroup, groupEnd, indentSelectedBlocks, isEditorSpacer, isListBlock, rootCache } from './model'
import { withHistoryBatch } from '../wysimark/utils/with-history-batch'
import { boundaryBlockIndex, insertBreakAtBoundary, isStructuredBlock, selectStructuredBoundary } from './boundary'
import { ReactEditor } from 'slate-react'
import { firstTextRect } from './first-line-alignment'
import { beginTableCellEdit } from '../wysimark/table-plugin/cell-selection'
import { isEditableStructure } from './structured-block'

type ArrowEvent={key:string;shiftKey?:boolean;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean;nativeEvent?:{isComposing?:boolean}}
type BlockSelection={index:number;range:Range;end?:number}
const staged=new WeakMap<Editor,BlockSelection>()
const contentSelections=new WeakMap<Editor,Range>()
const selectingBlock=new WeakSet<Editor>()
/** Whole-block ranges include folded descendants without entering their text. */
export function isBlockSelectionRange(editor:Editor,range:Range):boolean {
 const pending=staged.get(editor)
 return selectingBlock.has(editor)||!!pending&&Range.equals(pending.range,range)
}
const listeners=new WeakMap<Editor,Set<()=>void>>()
export function subscribeBlockSelection(editor:Editor,listener:()=>void) {
 let set=listeners.get(editor);if(!set){set=new Set();listeners.set(editor,set)}
 set.add(listener);return ()=>{set!.delete(listener)}
}
function setBlockSelection(editor:Editor,value:BlockSelection|undefined) {
 if(value)staged.set(editor,value);else staged.delete(editor)
 listeners.get(editor)?.forEach(listener=>listener())
}
export function clearBlockSelection(editor:Editor){contentSelections.delete(editor);if(staged.has(editor))setBlockSelection(editor,undefined)}
export function isWholeBlockSelected(editor:Editor,index:number):boolean {
 const pending=staged.get(editor)
 return !!pending&&!!editor.selection&&Range.equals(editor.selection,pending.range)&&
  index>=pending.index&&index<=Math.max(pending.range.anchor.path[0],pending.range.focus.path[0])
}
/** Keep explicit block selection after indentation, including repeated Tab. */
export function indentBlockSelection(editor:Editor,delta:1|-1):boolean {
 const pending=staged.get(editor),index=pending&&isWholeBlockSelected(editor,pending.index)?pending.index:undefined
 const handled=indentSelectedBlocks(editor,delta)
 if(handled&&index!==undefined) {
  if(pending?.end!==undefined)selectStructuralRange(editor,0,Editor.range(editor,[]),editor.children.length)
  else selectBlockContents(editor,index)
 }
 return handled
}
export function deleteWholeBlockSelection(editor:Editor):boolean {
 const pending=staged.get(editor)
 if(editor.wysimark.readOnly||!editor.selection)return false
 const selected=pending&&isWholeBlockSelected(editor,pending.index)?pending:undefined
 let index=selected?.index
 if(index===undefined&&Range.isCollapsed(editor.selection)) {
  const entry=Editor.above(editor,{match:n=>isStructuredBlock(n)&&editor.isVoid(n)})
  if(entry?.[1].length===1)index=entry[1][0]
 }
 if(index===undefined)return false
 clearBlockSelection(editor)
 return deleteBlockGroup(editor,index,selected?.end)
}
export function deleteAtBlockBoundary(editor:Editor):boolean {
 if(deleteWholeBlockSelection(editor))return true
 if(editor.wysimark.readOnly)return false
 if(editor.selection&&Range.isCollapsed(editor.selection)) {
  const point=editor.selection.anchor,index=point.path[0],node=editor.children[index]
  if(Element.isElement(node)&&node.type==='paragraph'&&!node.__subtitle&&
   Editor.isEmpty(editor,node)&&Point.equals(point,Editor.start(editor,[index]))) {
   const cache=rootCache(editor),previous=cache.previousVisible.get(node)
   const parent=previous===undefined?undefined:editor.children[previous]
   if(previous!==undefined&&Element.isElement(parent)&&parent.__collapsed&&cache.foldable.has(parent)) {
    // Merge the empty visible row with the visible parent, never a hidden child.
    withHistoryBatch(editor,()=>{
     // Make the visible rows adjacent before using Slate's normal merge. The
     // caret then follows the merge on both the initial edit and history replay.
     Transforms.moveNodes(editor,{at:[index],to:[previous+1]})
     Transforms.mergeNodes(editor,{at:[previous+1]})
    })
    return true
   }
  }
  // At the text start, outdent the subtree before Backspace can merge it.
  if(Element.isElement(node)&&!isEditorSpacer(node)&&!isStructuredBlock(node)&&
   !(isListBlock(node)&&Editor.isEmpty(editor,node))&&
   blockDepth(node)>0&&point.offset===0&&
   (Point.equals(point,Editor.start(editor,[index]))||Editor.before(editor,point,{unit:'character'})?.path[0]!==index))return changeBlockIndent(editor,index,-1)
 }
 const index=boundaryBlockIndex(editor)
 return index===undefined?false:selectBlockContents(editor,index)
}
function atVerticalEdge(editor:Editor,index:number,backwards:boolean):boolean {
 try {
  const root=ReactEditor.toDOMNode(editor,editor.children[index]),caret=ReactEditor.toDOMRange(editor,editor.selection!).getBoundingClientRect()
  let edge=firstTextRect(root)
  if(!backwards){const leaf=Array.from(root.querySelectorAll('[data-slate-string]')).filter(el=>el.textContent?.trim()).at(-1);if(leaf?.lastChild){const range=root.ownerDocument.createRange(),length=leaf.lastChild.textContent?.length||0;range.setStart(leaf.lastChild,Math.max(0,length-1));range.setEnd(leaf.lastChild,length);edge=range.getBoundingClientRect()}}
  return !!edge&&caret.bottom>=edge.top&&caret.top<=edge.bottom
 }catch{return false}
}
function blockSelectionRange(editor:Editor,index:number):Range {
 let last=groupEnd(editor.children,index)-1;while(last>index&&isEditorSpacer(editor.children[last]))last--
 return {anchor:Editor.start(editor,[index]),focus:Editor.end(editor,[last])}
}
export function selectBlockContents(editor:Editor,index:number):boolean {
 if(editor.wysimark.readOnly||!editor.children[index]||isEditorSpacer(editor.children[index]))return false
 return selectStructuralRange(editor,index,blockSelectionRange(editor,index))
}
function selectStructuralRange(editor:Editor,index:number,range:Range,end?:number):boolean {
 contentSelections.delete(editor)
 selectingBlock.add(editor)
 try{Transforms.select(editor,range)}finally{selectingBlock.delete(editor)}
 setBlockSelection(editor,{index,range,end})
 return true
}
/** Select text first; reserve structural block selection for handles and media. */
export function selectBlockOrDocument(editor:Editor):boolean {
 if(editor.wysimark.readOnly||!editor.selection)return false
 const range=editor.selection,index=boundaryBlockIndex(editor)??Range.start(range).path[0],node=editor.children[index]
 if(!Element.isElement(node)||isEditorSpacer(node))return false
 const block=Editor.range(editor,[index])
 const document=Editor.range(editor,[])
 const [start,end]=Range.edges(range)
 const remembered=contentSelections.get(editor)
 const covers=(target:Range)=>Point.equals(start,Range.start(target))&&Point.equals(end,Range.end(target))
 const complete=isWholeBlockSelected(editor,index)||!!remembered&&Range.equals(remembered,range)||
  Range.isExpanded(range)&&(covers(block)||covers(document))
 if(!complete) {
  if(editor.isVoid(node))return selectBlockContents(editor,index)
  clearBlockSelection(editor)
  Transforms.select(editor,block)
  contentSelections.set(editor,block)
  return true
 }
 return selectStructuralRange(editor,0,document,editor.children.length)
}
function enterStructure(editor:Editor,index:number,backwards:boolean):void {
 const point=backwards?Editor.end(editor,[index]):Editor.start(editor,[index])
 const node=editor.children[index]
 if(Element.isElement(node)&&node.type==='table') {
  const cell=Editor.above(editor,{at:point,match:n=>Element.isElement(n)&&n.type==='table-cell'})
  if(cell)beginTableCellEdit(editor,cell[1])
 }
 Transforms.select(editor,point)
}
/** Horizontal navigation visits the same outside caret for every structured block. */
export function navigateBlockBoundary(editor:Editor,event:ArrowEvent):boolean {
 const structured=isStructuredBlock
 if(editor.wysimark.readOnly||!editor.selection||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||event.nativeEvent?.isComposing)return false
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return false
 const boundary=boundaryBlockIndex(editor)
 if(boundary!==undefined) {
  if(event.key==='ArrowLeft') {
   if(!isEditableStructure(editor.children[boundary]))return selectBlockContents(editor,boundary)
   clearBlockSelection(editor);enterStructure(editor,boundary,true);return true
  }
  if(event.key==='ArrowUp'){clearBlockSelection(editor);Transforms.select(editor,Editor.end(editor,[boundary]));return true}
  let next=boundary+2;while(next<editor.children.length&&isEditorSpacer(editor.children[next]))next++
  if(next<editor.children.length){clearBlockSelection(editor);Transforms.select(editor,Editor.start(editor,[next]))}
  else if(event.key==='ArrowRight')return insertBreakAtBoundary(editor)
  return true
 }
 const pending=staged.get(editor)
 if(pending&&pending.end===undefined&&Range.equals(editor.selection,pending.range)&&structured(editor.children[pending.index])) {
  if(isEditableStructure(editor.children[pending.index])) {
   const index=pending.index
   clearBlockSelection(editor)
   Transforms.select(editor,event.key==='ArrowLeft'||event.key==='ArrowUp'?Editor.start(editor,[index]):Editor.end(editor,[index]))
   return true
  }
  if(event.key==='ArrowLeft'||event.key==='ArrowRight') {
   if(event.key==='ArrowRight'){clearBlockSelection(editor);return selectStructuredBoundary(editor,pending.index)}
   Transforms.select(editor,Editor.end(editor,[pending.index]));clearBlockSelection(editor);return true
  }
  const next=pending.index+(event.key==='ArrowUp'?-1:1)
  if(next>=0&&next<editor.children.length) {
   if(structured(editor.children[next])&&!isEditableStructure(editor.children[next]))selectBlockContents(editor,next)
   else {Transforms.select(editor,event.key==='ArrowUp'?Editor.end(editor,[next]):Editor.start(editor,[next]));clearBlockSelection(editor)}
  }
  return true
 }
 clearBlockSelection(editor)
 if(!Range.isCollapsed(editor.selection))return false
 const point=editor.selection.anchor,index=point.path[0],current=editor.children[index]
 if(structured(current)) {
  if(event.key==='ArrowRight'&&Point.equals(point,Editor.end(editor,[index])))return selectStructuredBoundary(editor,index)
  return false
 }
 const backwards=event.key==='ArrowLeft'||event.key==='ArrowUp'
 if(!Point.equals(point,backwards?Editor.start(editor,[index]):Editor.end(editor,[index]))&&(!['ArrowUp','ArrowDown'].includes(event.key)||!atVerticalEdge(editor,index,backwards)))return false
 let adjacent=index+(backwards?-1:1);while(adjacent>=0&&adjacent<editor.children.length&&isEditorSpacer(editor.children[adjacent]))adjacent+=backwards?-1:1
 const target=editor.children[adjacent]
 if(!structured(target))return false
 if(event.key==='ArrowLeft')return selectStructuredBoundary(editor,adjacent)
 if(isEditableStructure(target)) {
  // Native vertical movement retains the caret's visual column, including
  // proportional text, code indentation, wrapping and horizontal scrolling.
  if(event.key==='ArrowDown'&&Element.isElement(target)&&target.type==='code-block')return false
  enterStructure(editor,adjacent,backwards)
  return true
 }
 return backwards?selectStructuredBoundary(editor,adjacent):selectBlockContents(editor,adjacent)
}
