import { Editor, Element, Point, Range, Transforms } from 'slate'
import { deleteBlockGroup, groupEnd, indentSelectedBlocks, isEditorSpacer } from './model'
import { boundaryBlockIndex, isStructuredBlock, selectStructuredBoundary } from './boundary'
import { ReactEditor } from 'slate-react'
import { firstTextRect } from './first-line-alignment'

type ArrowEvent={key:string;shiftKey?:boolean;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean;nativeEvent?:{isComposing?:boolean}}
const staged=new WeakMap<Editor,{index:number;range:Range}>()
const structured=isStructuredBlock
const listeners=new WeakMap<Editor,Set<()=>void>>()
export function subscribeBlockSelection(editor:Editor,listener:()=>void) {
 let set=listeners.get(editor);if(!set){set=new Set();listeners.set(editor,set)}
 set.add(listener);return ()=>{set!.delete(listener)}
}
export function blockSelectionSnapshot(editor:Editor){return staged.get(editor)}
function setBlockSelection(editor:Editor,value:{index:number;range:Range}|undefined) {
 if(value)staged.set(editor,value);else staged.delete(editor)
 listeners.get(editor)?.forEach(listener=>listener())
}
export function clearBlockSelection(editor:Editor){if(staged.has(editor))setBlockSelection(editor,undefined)}
export function isWholeBlockSelected(editor:Editor,index:number):boolean {
 const pending=staged.get(editor)
 return !!pending&&!!editor.selection&&Range.equals(editor.selection,pending.range)&&
  index>=pending.index&&index<=Math.max(pending.range.anchor.path[0],pending.range.focus.path[0])
}
/** Keep explicit block selection after indentation, including repeated Tab. */
export function indentBlockSelection(editor:Editor,delta:1|-1):boolean {
 const pending=staged.get(editor),index=pending&&isWholeBlockSelected(editor,pending.index)?pending.index:undefined
 const handled=indentSelectedBlocks(editor,delta)
 if(handled&&index!==undefined)selectBlockContents(editor,index)
 return handled
}
export function deleteWholeBlockSelection(editor:Editor):boolean {
 const pending=staged.get(editor)
 if(editor.wysimark.readOnly||!pending||!isWholeBlockSelected(editor,pending.index))return false
 const index=pending.index
 clearBlockSelection(editor)
 return deleteBlockGroup(editor,index)
}
export function deleteAtBlockBoundary(editor:Editor):boolean {
 if(deleteWholeBlockSelection(editor))return true
 if(editor.wysimark.readOnly)return false
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
export function selectBlockContents(editor:Editor,index:number):boolean {
 if(editor.wysimark.readOnly||!editor.children[index]||isEditorSpacer(editor.children[index]))return false
 let last=groupEnd(editor.children,index)-1;while(last>index&&isEditorSpacer(editor.children[last]))last--
 const range={anchor:Editor.start(editor,[index]),focus:Editor.end(editor,[last])};Transforms.select(editor,range)
 setBlockSelection(editor,{index,range})
 return true
}
/** Cross a structured block boundary in two steps: select the block, then enter it. */
export function navigateBlockBoundary(editor:Editor,event:ArrowEvent):boolean {
 if(editor.wysimark.readOnly||!editor.selection||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||event.nativeEvent?.isComposing)return false
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return false
 const boundary=boundaryBlockIndex(editor)
 if(boundary!==undefined) {
  if(event.key==='ArrowLeft'||event.key==='ArrowRight')return selectBlockContents(editor,boundary)
  if(event.key==='ArrowUp'){clearBlockSelection(editor);Transforms.select(editor,Editor.end(editor,[boundary]));return true}
  let next=boundary+2;while(next<editor.children.length&&isEditorSpacer(editor.children[next]))next++
  if(next<editor.children.length){clearBlockSelection(editor);Transforms.select(editor,Editor.start(editor,[next]))}
  return true
 }
 const pending=staged.get(editor)
 if(pending&&Range.equals(editor.selection,pending.range)&&structured(editor.children[pending.index])) {
  if(event.key==='ArrowLeft'||event.key==='ArrowRight') {
   if(event.key==='ArrowRight'){clearBlockSelection(editor);return selectStructuredBoundary(editor,pending.index)}
   Transforms.select(editor,Editor.end(editor,[pending.index]));clearBlockSelection(editor);return true
  }
  const next=pending.index+(event.key==='ArrowUp'?-1:1)
  if(next>=0&&next<editor.children.length) {
   if(structured(editor.children[next]))selectBlockContents(editor,next)
   else {Transforms.select(editor,event.key==='ArrowUp'?Editor.end(editor,[next]):Editor.start(editor,[next]));clearBlockSelection(editor)}
  }
  return true
 }
 clearBlockSelection(editor)
 if(!Range.isCollapsed(editor.selection))return false
 const point=editor.selection.anchor,index=point.path[0],current=editor.children[index]
 if(structured(current))return false
 const backwards=event.key==='ArrowLeft'||event.key==='ArrowUp'
 if(!Point.equals(point,backwards?Editor.start(editor,[index]):Editor.end(editor,[index]))&&(!['ArrowUp','ArrowDown'].includes(event.key)||!atVerticalEdge(editor,index,backwards)))return false
 let adjacent=index+(backwards?-1:1);while(adjacent>=0&&adjacent<editor.children.length&&isEditorSpacer(editor.children[adjacent]))adjacent+=backwards?-1:1
 if(!structured(editor.children[adjacent]))return false
 return backwards?selectStructuredBoundary(editor,adjacent):selectBlockContents(editor,adjacent)
}
