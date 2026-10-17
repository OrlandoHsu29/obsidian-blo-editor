import { Editor, Element } from 'slate'
export function selectionHasHeading(editor:Editor) {
 if(!editor.selection)return false
 return [...Editor.nodes(editor,{match:n=>Element.isElement(n)&&n.type==='heading'})].length>0
}
