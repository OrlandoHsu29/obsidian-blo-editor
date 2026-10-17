import { createPlugin, TypedPlugin } from '../wysimark/sink'
import { indentSelectedBlocks, normalizeOrderedText } from './model'
import { cleanPastedFragment } from './typography'
import type { Descendant } from 'slate'
import { navigateBlockBoundary } from './selection'
import { exitEmptyQuote } from './subtitle'
type Types={Name:'block-structure';Editor:{}}
export const BlockStructurePlugin=createPlugin<Types>(editor=>{
 const {insertFragment}=editor
 editor.insertFragment=(fragment,options)=>insertFragment(cleanPastedFragment(fragment as Descendant[]),options)
 return {
 name:'block-structure',editor:{normalizeNode:entry=>normalizeOrderedText(editor,entry),insertBreak:()=>exitEmptyQuote(editor)},
 editableProps:{onKeyDown:event=>{
  if(navigateBlockBoundary(editor,event)){event.preventDefault();event.stopPropagation();return true}
  if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey||event.nativeEvent?.isComposing)return false
  if(!indentSelectedBlocks(editor,event.shiftKey?-1:1))return false
  event.preventDefault();event.stopPropagation();return true
 }},
}}) as TypedPlugin<Types>
