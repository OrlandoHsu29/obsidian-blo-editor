import { Editor, Element, Range, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { rootCache } from './model'
import { withHistoryBatch } from '../wysimark/utils/with-history-batch'

/** Folding retains every child in Slate; only its presentation is hidden. */
export function toggleBlockFold(editor:Editor,index:number):void {
  const node=editor.children[index]
  if(!Element.isElement(node)||!rootCache(editor).foldable.has(node))return
  withHistoryBatch(editor,()=>{
    if(node.__collapsed)Transforms.unsetNodes(editor,'__collapsed',{at:[index]})
    else {Transforms.setNodes(editor,{__collapsed:true},{at:[index]});relocateFoldedSelection(editor)}
  })
}

/** Also runs during redo, whose restored selection may still be in a child. */
export function relocateFoldedSelection(editor:Editor):void {
  if(editor.wysimark.readOnly||!editor.selection)return
  const cache=rootCache(editor),owner=[editor.selection.anchor,editor.selection.focus].map(point=>cache.foldedBy.get(editor.children[point.path[0]])).find(Boolean)
  const index=owner?cache.indices.get(owner):undefined
  if(index!==undefined)Transforms.select(editor,Editor.end(editor,[index]))
}

/** Search, outlines and keyboard selection reveal any collapsed ancestors. */
export function revealFoldedSelection(editor:Editor,selection:Range):boolean {
  let changed=false
  const reveal=()=>{
    for(let level=0;level<=32;level++) {
      const cache=rootCache(editor),owners=new Set([selection.anchor,selection.focus].map(point=>editor.children[point.path[0]]).map(node=>cache.foldedBy.get(node)).filter(Boolean))
      if(!owners.size)return
      for(const owner of owners){const index=cache.indices.get(owner!);if(index!==undefined){Transforms.unsetNodes(editor,'__collapsed',{at:[index]});changed=true}}
    }
  }
  if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withoutSaving(editor,reveal)
  else reveal()
  return changed
}
