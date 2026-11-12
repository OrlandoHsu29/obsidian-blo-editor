import { createPlugin, TypedPlugin } from '../sink'
import { Editor, Element, Path, Range } from 'slate'
import { removeMarks } from './methods/removeMarks'

// Run after any block-break handler, including lists, headings and tables.
// Soft breaks stay in the same block and retain its inline formatting.
type MarkBoundaryTypes = { Name: 'mark-boundary'; Editor: {} }
export const MarkBoundaryPlugin = createPlugin<MarkBoundaryTypes>(editor => ({
  name: 'mark-boundary',
  editor: { insertBreak: () => {
    if(!editor.selection)return
    const entry=Editor.above(editor,{at:Range.start(editor.selection),match:n=>Element.isElement(n)&&Editor.isBlock(editor,n),mode:'lowest'})
    if(!entry)return
    const previous=Editor.pathRef(editor,entry[1],{affinity:'backward'})
    return () => {
      const path=previous.unref()
      if(!path||!editor.selection||!Range.isCollapsed(editor.selection))return
      const next=Editor.above(editor,{match:n=>Element.isElement(n)&&Editor.isBlock(editor,n),mode:'lowest'})
      if(!next||Path.equals(path,next[1]))return
      // Empty split leaves must be cleared too, so selection sync cannot
      // restore formatting. Existing text moved by a mid-block split stays intact.
      if(Element.isElement(next[0])&&Editor.isEmpty(editor,next[0]))removeMarks(editor,{at:next[1]})
      editor.activeMarks={}
      editor.marks={}
    }
  } },
})) as TypedPlugin<MarkBoundaryTypes>
