import { Editor, Element, Node, Path, Transforms } from "slate"

import { findElementUp } from "../../sink"
import type { CodeBlockElement } from "../types"
import { isListItem } from '../../list-plugin'
import { blockDepth } from '../../../blocks/model'
import { removeMarks } from '../../marks-plugin/methods/removeMarks'

export function convertCodeBlockToParagraph(editor: Editor, at?: Path): boolean {
  const entry = at ? Editor.node(editor, at) : findElementUp<CodeBlockElement>(editor, "code-block")
  if (!entry || !Element.isElement(entry[0]) || entry[0].type !== 'code-block') return false
  const [block, path] = entry
  Editor.withoutNormalizing(editor, () => {
    // Merge in place so Slate keeps caret/range references, block identity and
    // undo/redo positions instead of detaching them during node replacement.
    for (let i = block.children.length - 1; i > 0; i--) {
      const line = [...path, i]
      Transforms.insertText(editor, '\n', { at: Editor.start(editor, line) })
      Transforms.mergeNodes(editor, { at: line })
    }
    Transforms.setNodes(editor, { type: 'paragraph', __blockDepth: blockDepth(block) }, { at: path })
    Transforms.unsetNodes(editor, 'language', { at: path })
    Transforms.unwrapNodes(editor, { at: [...path, 0] })
    removeMarks(editor, { at: path })
    const paragraph = Node.get(editor, path)
    if (Element.isElement(paragraph)) for (let i = paragraph.children.length - 1; i > 0; i--) {
      Transforms.mergeNodes(editor, { at: [...path, i] })
    }
    const parentPath = Path.parent(path)
    if (parentPath.length) {
      const parent = Node.get(editor, parentPath)
      if (isListItem(parent) && parent.blockChildren && parent.children.length === 1 &&
          'type' in parent.children[0] && parent.children[0].type === 'paragraph') {
        Transforms.unwrapNodes(editor, { at: [...parentPath, 0] })
        Transforms.unsetNodes(editor, 'blockChildren', { at: parentPath })
      }
    }
  })
  return true
}
