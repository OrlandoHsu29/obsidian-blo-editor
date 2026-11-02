import { Editor, Element, Path, Range, Transforms } from 'slate'
import { withHistoryBatch } from '../utils/with-history-batch'

/** Remove one quote level before Backspace can merge text across its boundary. */
export function deleteQuotePrefix(editor: Editor): boolean {
  const selection = editor.selection
  if (editor.wysimark.readOnly || !selection || !Range.isCollapsed(selection)) return false
  const point = selection.anchor
  if (point.offset !== 0) return false
  const quote = Editor.above(editor, {
    match: node => Element.isElement(node) && node.type === 'block-quote',
  })
  if (!quote) return false
  const block = Editor.above(editor, {
    match: node => Element.isElement(node) && Editor.isBlock(editor, node),
  })
  if (!block || !Path.equals(block[1], [...quote[1], 0])) return false

  // A link's first character and the empty text before it share a visual start.
  const prefix = { anchor: Editor.start(editor, block[1]), focus: point }
  if (Editor.string(editor, prefix) !== '') return false
  for (const _entry of Editor.nodes(editor, {
    at: prefix, match: node => Element.isElement(node) && Editor.isVoid(editor, node),
  })) return false

  withHistoryBatch(editor, () => {
    Transforms.unwrapNodes(editor, {
      match: node => Element.isElement(node) && node.type === 'block-quote',
      mode: 'lowest', split: true,
    })
  })
  return true
}
