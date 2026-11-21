import { Editor, Element, Node, Path, Range, Text } from 'slate'
import type { Descendant } from 'slate'
import { blockDepth, isEditorSpacer, isListBlock } from './model'

function styledTextBlock(node: Descendant): node is Element {
  return Element.isElement(node) && (node.type === 'heading' || isListBlock(node) || node.type === 'paragraph' && !!node.__subtitle)
}

function inlineContent(editor: Editor, node: Element): Descendant[] | undefined {
  const children = node.children as Descendant[]
  if (children.every(child => Text.isText(child) || editor.isInline(child as Element))) return children
  const first = children[0]
  if (children.length === 1 && Element.isElement(first) && (first.type === 'heading' || first.type === 'paragraph')) return inlineContent(editor, first)
}

/** Ordinary prose supplies content, rather than replacing the destination style. */
export function pasteTextContent(editor: Editor, fragment: Descendant[]): Descendant[] {
  const first = fragment[0], selection = editor.selection
  if (!selection || fragment.length !== 1 || !Element.isElement(first)) return fragment
  if (Range.isCollapsed(selection) && (first.type === 'image-block' ||
    first.type === 'paragraph' && !Node.string(first).includes('\n'))) {
    const target = Editor.above<Element>(editor, { match: node => Element.isElement(node) && node.type === 'paragraph' })?.[0]
    if (target && !target.__subtitle && !isEditorSpacer(target) && Editor.isEmpty(editor, target)) {
      const depth = blockDepth(target), quoteDepth = target.__quoteIndent
      if (depth || quoteDepth) return [{ ...first, __blockDepth: depth, ...(quoteDepth ? { __quoteIndent: quoteDepth } : {}) }]
    }
  }
  if (first.type !== 'paragraph' || first.__subtitle) return fragment
  const target = Editor.above(editor, { at: Range.start(selection), match: n => Element.isElement(n) && styledTextBlock(n), mode: 'lowest' })
  if (!target || !Path.isAncestor(target[1], Range.end(selection).path) ||
    !(target[0].children as Descendant[]).every(child => Text.isText(child) || editor.isInline(child as Element))) return fragment
  return first.children
}

/** Partial selections contain text and marks; only complete blocks carry styles. */
export function copiedTextContent(editor: Editor, fragment: Descendant[]): Descendant[] {
  if (!editor.selection) return fragment
  const selection = editor.selection, start = Range.start(selection).path[0]
  return fragment.map((node, offset) => {
    if (!styledTextBlock(node)) return node
    const children = inlineContent(editor, node)
    if (!children) return node
    const original = editor.children[start + offset]
    if (!original) return node
    const range = Editor.range(editor, [start + offset])
    if (Range.includes(selection, range.anchor) && Range.includes(selection, range.focus)) return node
    return { type: 'paragraph', children }
  })
}
