import { Editor, Element, Node } from 'slate'

export function isHeading(node: Node): node is Extract<Element, { type: 'heading' }> {
 return Element.isElement(node) && node.type === 'heading'
}

const isMainHeading = (node: Node | undefined) => node !== undefined && isHeading(node) && node.level !== 5

export function selectionHasHeading(editor:Editor) {
 return !!editor.selection && !Editor.nodes(editor,{match:isHeading}).next().done
}
/** Also detect heading owners so a body selection cannot rewrite its containing heading list. */
export function isMainHeadingOrOwner(node: Node): boolean {
 return isMainHeading(node) || Element.isElement(node) && node.type === 'ordered-list-item' && !!node.blockChildren && isMainHeading(node.children[0])
}
