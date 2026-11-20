import { Editor, Element, Node, Path } from 'slate'
import type { Descendant } from 'slate'
import { HistoryEditor } from 'slate-history'
import { restoreInlineMathText } from './inline-text'

const isHeading = (node: Node) => Element.isElement(node) && node.type === 'heading'

function inHeading(editor: Editor, path: Path): boolean {
  return path.length > 1 && !!Editor.above(editor, { at: path, match: isHeading })
}

function headingMathAsText(node: Descendant, insideHeading = false): Descendant {
  if (!Element.isElement(node)) return node
  if (insideHeading && node.type === 'math-inline') return { text: node.latex }
  const heading = insideHeading || isHeading(node)
  const children = node.children.map(child => headingMathAsText(child, heading))
  return children.some((child, index) => child !== node.children[index]) ? { ...node, children } as Descendant : node
}

/** Limit new heading content without altering formulas loaded from existing notes. */
export function withHeadingMathPolicy(editor: Editor): void {
  const { apply } = editor
  editor.apply = operation => {
    if (HistoryEditor.isSaving(editor) === false) return apply(operation)
    if (operation.type === 'insert_node' && Element.isElement(operation.node)) {
      const parent = Node.parent(editor, operation.path)
      const heading = isHeading(parent) || inHeading(editor, Path.parent(operation.path))
      const node = headingMathAsText(operation.node, heading)
      return apply(node === operation.node ? operation : { ...operation, node })
    }
    if (operation.type === 'set_node' && 'type' in operation.newProperties && operation.newProperties.type === 'heading' &&
      !isHeading(Node.get(editor, operation.path))) {
      return Editor.withoutNormalizing(editor, () => {
        apply(operation)
        restoreInlineMathText(editor, operation.path)
      })
    }
    if (operation.type === 'move_node') {
      const node = Node.get(editor, operation.path)
      const destination = Path.transform(operation.path, operation)
      if (destination && Element.isElement(node) && editor.isInline(node)) {
        return Editor.withoutNormalizing(editor, () => {
          apply(operation)
          if (inHeading(editor, destination)) restoreInlineMathText(editor, destination)
        })
      }
    }
    apply(operation)
  }
}
