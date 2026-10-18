import { Editor, Element, Node, NodeEntry, Range, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { blockDepth, isEditorSpacer } from './model'

export const isStructuredBlock = (node: unknown): node is Element =>
  Element.isElement(node) && (node.type === 'table' || node.type === 'code-block')

/** Navigation paragraphs are real Slate points, omitted from Markdown. */
export function normalizeStructuredBoundary(editor: Editor, [node, path]: NodeEntry<Node>): boolean {
  if (path.length !== 1) return false
  const index = path[0]
  const previous = editor.children[index - 1]
  const before = isStructuredBlock(previous) && !isEditorSpacer(node)
  if (!before && !isStructuredBlock(node)) return false
  const next = editor.children[index + 1]
  if (!before && next && isEditorSpacer(next)) return false
  Transforms.insertNodes(editor, {
    type: 'paragraph', __collapsible: true, children: [{ text: '' }],
  }, { at: [before ? index : index + 1] })
  return true
}

export function boundaryBlockIndex(editor: Editor): number | undefined {
  const selection = editor.selection
  if (!selection || !Range.isCollapsed(selection)) return
  const index = selection.anchor.path[0]
  if (index > 0 && isEditorSpacer(editor.children[index]) && isStructuredBlock(editor.children[index - 1])) return index - 1
}

export function selectStructuredBoundary(editor: Editor, index: number): boolean {
  const node = editor.children[index]
  if (editor.wysimark.readOnly || !isStructuredBlock(node)) return false
  Editor.withoutNormalizing(editor, () => {
    normalizeStructuredBoundary(editor, [node, [index]])
    Transforms.select(editor, Editor.start(editor, [index + 1]))
    editor.marks = null
  })
  return true
}

export function insertBreakAtBoundary(editor: Editor): boolean {
  const block = boundaryBlockIndex(editor)
  if (editor.wysimark.readOnly || block === undefined) return false
  const index = editor.selection!.anchor.path[0]
  const node = editor.children[block]
  const indentation = blockDepth(node) || (Element.isElement(node) && node.__blockDepth !== undefined)
    ? { __blockDepth: blockDepth(node) } : {}
  const insert = () => Editor.withoutNormalizing(editor, () => {
    Transforms.insertNodes(editor, { type: 'paragraph', ...indentation, children: [{ text: '' }] }, { at: [index + 1] })
    Transforms.select(editor, Editor.start(editor, [index + 1]))
    editor.marks = null
  })
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, insert)
  else insert()
  return true
}
