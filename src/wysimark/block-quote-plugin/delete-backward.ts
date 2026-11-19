import { Editor, Element, Path, Range, Transforms } from 'slate'
import { withHistoryBatch } from '../utils/with-history-batch'
import { blockDepth, isListBlock } from '../../blocks/model'

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
  const list=Editor.above(editor,{at:point,match:isListBlock})
  if(list&&Editor.isStart(editor,point,list[1]))return false
  const block = Editor.above(editor, {
    match: node => Element.isElement(node) && Editor.isBlock(editor, node),
  })
  if (!block || !Path.equals(Path.parent(block[1]), quote[1])) return false
  const firstChild = block[1][block[1].length - 1] === 0
  if (!firstChild && (block[0].type !== 'paragraph' || !Editor.isEmpty(editor, block[0]))) return false

  // A link's first character and the empty text before it share a visual start.
  const prefix = { anchor: Editor.start(editor, block[1]), focus: point }
  if (Editor.string(editor, prefix) !== '') return false
  for (const _entry of Editor.nodes(editor, {
    at: prefix, match: node => Element.isElement(node) && Editor.isVoid(editor, node),
  })) return false

  withHistoryBatch(editor, () => {
    const depth=blockDepth(quote[0])
    if(depth>blockDepth(block[0]))Transforms.setNodes(editor,{__blockDepth:depth},{at:block[1]})
    Transforms.liftNodes(editor, { at: block[1] })
  })
  return true
}
