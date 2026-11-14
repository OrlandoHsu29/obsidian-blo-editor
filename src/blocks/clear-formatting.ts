import { Editor, Element, Node, Point, Range, Transforms } from 'slate'
import { blockDepth, canIndentBlock, isListBlock } from './model'
import { setHeadingNode } from './heading-conversion'
import { setListBlock } from './list-container'
import { convertCodeBlockToParagraph } from '../wysimark/code-block-plugin/methods/convertCodeBlockToParagraph'

/** An end caret at the next block's start does not include its paragraph style. */
function selectedStyles(editor: Editor, selection: Range): Range {
  const [start, end] = Range.edges(selection)
  if (Range.isExpanded(selection) && end.path[0] > start.path[0] && Point.equals(end, Editor.start(editor, [end.path[0]]))) {
    const before = Editor.end(editor, [end.path[0] - 1])
    return Range.isBackward(selection) ? { anchor: before, focus: start } : { anchor: start, focus: before }
  }
  return selection
}

/** Reset paragraph presentation using the same primitives as heading/list commands. */
export function clearSelectedBlockStyles(editor: Editor, at: Range): void {
  const selected = Editor.rangeRef(editor, selectedStyles(editor, at), { affinity: 'inward' })
  try {
    const convert = (match: (node: Node) => boolean, run: (node: Element, path: number[]) => void) => {
      const refs = [...Editor.nodes(editor, { at: selected.current!, match })].map(([, path]) => Editor.pathRef(editor, path))
      try {
        for (const ref of refs.reverse()) if (ref.current) {
          const node = Node.get(editor, ref.current)
          if (Element.isElement(node)) run(node, ref.current)
        }
      } finally { refs.forEach(ref => ref.unref()) }
    }
    convert(node => Element.isElement(node) && node.type === 'code-block', (_, path) => convertCodeBlockToParagraph(editor, path))
    convert(isListBlock, (node, path) => setListBlock(editor, node, path))
    convert(node => Element.isElement(node) && (node.type === 'heading' || node.type === 'paragraph' && !!node.__subtitle),
      (_, path) => setHeadingNode(editor, path, undefined))

    const quote = (node: Node) => Element.isElement(node) && node.type === 'block-quote' && !node.footnoteIdentifier
    const at = selected.current!, [start, end] = Range.edges(at)
    // Keep indentation and block identity when a quote wrapper disappears.
    for (const [, path] of Editor.nodes(editor, { at, match: quote })) {
      const node = Node.get(editor, path)
      if (!Element.isElement(node)) continue
      const complete = Point.compare(start, Editor.start(editor, path)) <= 0 && Point.compare(end, Editor.end(editor, path)) >= 0
      node.children.forEach((child, index) => {
        if (!Element.isElement(child)) return
        const childPath = [...path, index]
        if (!Range.intersection(at, Editor.range(editor, childPath))) return
        const props = {
          ...(canIndentBlock(child) && blockDepth(node) > blockDepth(child) ? { __blockDepth: blockDepth(node) } : {}),
          ...(complete && index === 0 && node.__blockId ? { __blockId: node.__blockId } : {}),
        }
        if (Object.keys(props).length) Transforms.setNodes(editor, props, { at: childPath })
      })
    }
    Transforms.unwrapNodes(editor, { at, match: quote, mode: 'all', split: true })
  } finally { selected.unref() }
}
