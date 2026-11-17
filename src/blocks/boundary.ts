import { Editor, Element, Node, NodeEntry, Point, Range, Transforms } from 'slate'
import { withHistoryBatch } from '../wysimark/utils/with-history-batch'
import { blockDepth, changeBlockIndent, isEditorSpacer } from './model'
import { isStructuredBlock } from './structured-block'

export { isStructuredBlock } from './structured-block'

const boundaryInputScroll = new WeakMap<Editor, number>()

/** The first text row needs nearest-edge scrolling rather than Slate's centering. */
export function takeBoundaryInputScroll(editor: Editor): boolean {
  const index = boundaryInputScroll.get(editor)
  boundaryInputScroll.delete(editor)
  return index !== undefined && editor.selection?.anchor.path[0] === index
}

/** Turn the right-side insertion caret into a separate durable text row. */
export function materializeTextBoundary(editor: Editor): boolean {
  if (!editor.selection) return false
  const index = editor.selection.anchor.path[0], node = editor.children[index]
  if (!isEditorSpacer(node)) return false
  Transforms.setNodes(editor, {
    __collapsible: undefined, __blockDepth: blockDepth(editor.children[index - 1] ?? node),
  }, { at: [index] })
  // Normalization inserts a replacement spacer before this now-durable row.
  if (isStructuredBlock(editor.children[index - 1])) boundaryInputScroll.set(editor, index + 1)
  return true
}

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

export function boundaryBlockIndex(editor: Editor, point?: Point): number | undefined {
  const selection = editor.selection
  if (!point && (!selection || !Range.isCollapsed(selection))) return
  const index = (point ?? selection!.anchor).path[0]
  if (index > 0 && isEditorSpacer(editor.children[index]) && isStructuredBlock(editor.children[index - 1])) return index - 1
}

/** Include the complete media block while retaining a real text/void anchor. */
export function rangeToMediaBlock(editor: Editor, index: number, anchor: Point): Range | undefined {
  const node=editor.children[index]
  if(!Element.isElement(node)||node.type!=='image-block')return
  const origin=boundaryBlockIndex(editor,anchor)??anchor.path[0],original=editor.children[origin]
  const after=(at:number)=>Editor.after(editor,[at],{voids:true})??Editor.end(editor,[at])
  if(Element.isElement(original)&&original.type==='image-block')anchor=origin>index?after(origin):Editor.start(editor,[origin])
  const start=Editor.start(editor,[index])
  return {anchor,focus:Point.compare(anchor,start)>0?start:after(index)}
}

/** Slate unhangs a range ending at the next paragraph's start by default.
 * Our empty boundary is after the entire widget, so keep that endpoint intact. */
export function deleteRangeEndingAtBoundary(editor: Editor): boolean {
  const selection=editor.selection
  if(editor.wysimark.readOnly||!selection||!Range.isExpanded(selection)||boundaryBlockIndex(editor,Range.end(selection))===undefined)return false
  withHistoryBatch(editor,()=>Transforms.delete(editor,{hanging:true}))
  return true
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

/** Empty indented prose leaves one level instead of creating another empty row. */
export function outdentEmptyParagraph(editor: Editor): boolean {
  if (editor.wysimark.readOnly || !editor.selection || !Range.isCollapsed(editor.selection)) return false
  const index = editor.selection.anchor.path[0], node = editor.children[index]
  return Element.isElement(node) && node.type === 'paragraph' && Editor.isEmpty(editor, node) &&
    changeBlockIndent(editor, index, -1)
}

export function insertBreakAtBoundary(editor: Editor): boolean {
  const block = boundaryBlockIndex(editor)
  if (editor.wysimark.readOnly || block === undefined) return false
  const index = editor.selection!.anchor.path[0]
  const node = editor.children[block]
  const indentation = blockDepth(node) || (Element.isElement(node) && node.__blockDepth !== undefined)
    ? { __blockDepth: blockDepth(node) } : {}
  withHistoryBatch(editor, () => {
    Transforms.insertNodes(editor, { type: 'paragraph', ...indentation, children: [{ text: '' }] }, { at: [index + 1] })
    Transforms.select(editor, Editor.start(editor, [index + 1]))
    editor.marks = null
  })
  return true
}
