import { Editor, Element, Node, NodeEntry, Transforms } from "slate"
import { imageRowCaret, rowImages } from '../row-model'

export function normalizeNode(editor: Editor, [node, path]: NodeEntry<Node>): boolean {
  if (Element.isElement(node) && node.type === 'image-row') {
    const images = rowImages(node)
    const invalid = node.children.findIndex(child => !Element.isElement(child) || (child.type !== 'image-block' && child.type !== 'image-row-caret'))
    if (invalid !== -1) {
      const child = node.children[invalid]
      if (Element.isElement(child)) Transforms.liftNodes(editor, { at: [...path, invalid] })
      else Transforms.removeNodes(editor, { at: [...path, invalid] })
      return true
    }
    if (!images.length) {
      Transforms.removeNodes(editor, { at: path })
      return true
    }
    if (images.length === 1 && !node.retainLeadingCaret) {
      const {type, children, ...metadata} = node
      Editor.withoutNormalizing(editor, () => {
        Transforms.removeNodes(editor, {at:path})
        Transforms.insertNodes(editor, {...images[0],...metadata}, {at:path})
      })
      return true
    }
    for (let index = 0; index < node.children.length; index++) {
      const child = node.children[index]
      if (index % 2 === 0 && child.type === 'image-block') {
        Transforms.insertNodes(editor,imageRowCaret(),{at:[...path,index]})
        return true
      }
      if (child.type === 'image-row-caret' && (index % 2 === 1 || index === node.children.length - 1)) {
        Transforms.removeNodes(editor,{at:[...path,index]})
        return true
      }
    }
  }
  return false
}
