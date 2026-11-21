import { Editor, Element, Node, Path, Range, Transforms } from 'slate'
import { getCalloutInfo } from '../wysimark/block-quote-plugin/callout'
import { withHistoryBatch } from '../wysimark/utils/with-history-batch'
import { canIndentBlock, isEditorSpacer } from './model'

function isOrdinaryQuote(node: Node): node is Element & { type: 'block-quote' } {
  return Element.isElement(node) && node.type === 'block-quote' && !node.footnoteIdentifier && !getCalloutInfo(node)
}

const sharedIndents = new WeakMap<Element, number>()

export function sharedQuoteIndent(node: Node): number {
  if (!isOrdinaryQuote(node)) return 0
  const cached = sharedIndents.get(node)
  if (cached !== undefined) return cached

  let depth = Infinity
  for (const child of node.children) {
    if (isEditorSpacer(child)) continue
    const indent = isOrdinaryQuote(child) ? sharedQuoteIndent(child) : Element.isElement(child) ? child.__quoteIndent ?? 0 : 0
    depth = Math.min(depth, indent)
    if (!depth) break
  }
  if (!Number.isFinite(depth)) depth = 0
  sharedIndents.set(node, depth)
  return depth
}

export function isQuoteContent(editor: Editor, path: Path): boolean {
  return path.length >= 2 && isOrdinaryQuote(Node.parent(editor, path))
}

export function indentQuoteContents(editor: Editor, delta: 1 | -1): boolean {
  const selection = editor.selection
  if (editor.wysimark.readOnly || !selection) return false
  const [start, end] = Range.edges(selection)
  const root = editor.children[start.path[0]]
  if (start.path[0] !== end.path[0] || !isOrdinaryQuote(root)) return false

  const entries = Array.from(Editor.nodes<Element>(editor, {
    at: selection,
    match: (node, path): node is Element => Element.isElement(node) && node.type !== 'block-quote' &&
      canIndentBlock(node) && !isEditorSpacer(node) && isQuoteContent(editor, path),
  })).filter(([, path]) => Range.isCollapsed(selection) || Path.isAncestor(path, start.path) ||
    !Editor.isStart(editor, end, path))
  if (!entries.length) return false

  withHistoryBatch(editor, () => {
    for (const [node, path] of entries) {
      const depth = node.__quoteIndent ?? 0
      const next = Math.max(0, Math.min(32, depth + delta))
      if (next === depth) continue
      if (next === 0) Transforms.unsetNodes(editor, '__quoteIndent', { at: path })
      else Transforms.setNodes(editor, { __quoteIndent: next }, { at: path })
    }
  })
  return true
}
