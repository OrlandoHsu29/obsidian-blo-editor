import { Editor, Element } from 'slate'
export function selectionHasHeading(editor:Editor) {
 if(!editor.selection)return false
 return [...Editor.nodes(editor,{match:n=>Element.isElement(n)&&n.type==='heading'})].length>0
}
/** Also detect heading owners so a body selection cannot rewrite its containing heading list. */
export function selectionHasMainHeading(editor:Editor) {
 if(!editor.selection)return false
 const main=(node:unknown)=>Element.isElement(node)&&node.type==='heading'&&node.level!==5
 return !!Editor.nodes(editor,{match:n=>main(n)||(Element.isElement(n)&&n.type==='ordered-list-item'&&n.blockChildren&&main(n.children[0]))}).next().value
}
