import { Editor, Element, Point, Range, Transforms } from 'slate'
import { groupEnd, isEditorSpacer } from './model'
import { ReactEditor } from 'slate-react'
import { firstTextRect } from './first-line-alignment'

type ArrowEvent={key:string;shiftKey?:boolean;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean;nativeEvent?:{isComposing?:boolean}}
const staged=new WeakMap<Editor,{index:number;range:Range}>()
const structured=(node:unknown)=>Element.isElement(node)&&['table','code-block'].includes(node.type)
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
 if(last===index&&structured(editor.children[index]))staged.set(editor,{index,range});else staged.delete(editor)
 return true
}
/** Cross a structured block boundary in two steps: select the block, then enter it. */
export function navigateBlockBoundary(editor:Editor,event:ArrowEvent):boolean {
 if(editor.wysimark.readOnly||!editor.selection||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||event.nativeEvent?.isComposing)return false
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return false
 const pending=staged.get(editor)
 if(pending&&Range.equals(editor.selection,pending.range)&&structured(editor.children[pending.index])) {
  if(event.key==='ArrowLeft'||event.key==='ArrowRight') {
   Transforms.select(editor,event.key==='ArrowLeft'?Editor.end(editor,[pending.index]):Editor.start(editor,[pending.index]));staged.delete(editor);return true
  }
  const next=pending.index+(event.key==='ArrowUp'?-1:1)
  if(next>=0&&next<editor.children.length) {
   if(structured(editor.children[next])){const range=Editor.range(editor,[next]);Transforms.select(editor,range);staged.set(editor,{index:next,range})}
   else {Transforms.select(editor,event.key==='ArrowUp'?Editor.end(editor,[next]):Editor.start(editor,[next]));staged.delete(editor)}
  }
  return true
 }
 staged.delete(editor)
 if(!Range.isCollapsed(editor.selection))return false
 const point=editor.selection.anchor,index=point.path[0],current=editor.children[index]
 if(structured(current))return false
 const backwards=event.key==='ArrowLeft'||event.key==='ArrowUp'
 if(!Point.equals(point,backwards?Editor.start(editor,[index]):Editor.end(editor,[index]))&&(!['ArrowUp','ArrowDown'].includes(event.key)||!atVerticalEdge(editor,index,backwards)))return false
 let adjacent=index+(backwards?-1:1);while(adjacent>=0&&adjacent<editor.children.length&&isEditorSpacer(editor.children[adjacent]))adjacent+=backwards?-1:1
 if(!structured(editor.children[adjacent]))return false
 const range=Editor.range(editor,[adjacent]);Transforms.select(editor,range);staged.set(editor,{index:adjacent,range});return true
}
