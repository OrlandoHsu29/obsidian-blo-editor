import { Editor, Element, Node, Point, Range, Text, Transforms } from "slate"
import type { Descendant } from "slate"
import { HistoryEditor } from "slate-history"
import { createPlugin, TypedPlugin } from "../sink"
import { MathFormula } from "./MathFormula"
import { editMath } from "./editing"
import type { MathElement, MathPluginCustomTypes } from "./types"
import { materializeTextBoundary } from "../../blocks/boundary"
import { mathSelectionSource } from './selection-source'
import { restoreInlineMathText, selectedInlineMath } from './inline-text'
import { withHistoryBatch } from '../utils/with-history-batch'
import { selectionHasHeading } from '../../blocks/heading-policy'
import { withHeadingMathPolicy } from './heading-math'

const isMath = (node: unknown): node is MathElement => Element.isElement(node) && (node.type === "math-inline" || node.type === "math-block")
export function canInsertMath(editor: Editor): boolean {
  return !editor.wysimark.readOnly && !!editor.selection && !selectionHasHeading(editor) && !Editor.above(editor, {
    match: node => Element.isElement(node) && ['inline-code', 'code-block', 'html-block', 'link-definition'].includes(node.type),
  })
}
function editSelectedMath(editor: Editor) {
  const inserted = Editor.above<MathElement>(editor, { match: isMath })
  if (inserted) editMath(editor, inserted[0])
}
/** A display formula the caret is in, or that the selection covers completely. */
function selectedMathBlock(editor: Editor): { node: MathElement; path: number[] } | undefined {
  const selection = editor.selection
  if (!selection) return
  const isBlock = (node: unknown): node is MathElement => Element.isElement(node) && node.type === 'math-block'
  if (Range.isCollapsed(selection)) {
    const entry = Editor.above<MathElement>(editor, { match: isBlock })
    return entry && { node: entry[0], path: entry[1] }
  }
  const [start, end] = Range.edges(selection)
  for (const [node, path] of Editor.nodes<MathElement>(editor, { at: selection, match: isBlock, voids: true })) {
    if (Point.compare(start, Editor.start(editor, path)) <= 0 && Point.compare(end, Editor.end(editor, path)) >= 0) return { node, path }
  }
}

const hasVisibleContent = (nodes: Descendant[]) => nodes.some(node => Text.isText(node) ? !!node.text.trim() : true)
/** A rebuilt paragraph must not begin or end with an inline node. */
function withTextEdges(children: Descendant[]): Descendant[] {
  const result = [...children]
  if (!result.length || !Text.isText(result[0])) result.unshift({ text: '' })
  if (!Text.isText(result[result.length - 1])) result.push({ text: '' })
  return result
}

/** Switch an inline formula to its own centered block, splitting the surrounding text. */
function inlineToBlock(editor: Editor, selected: { node: MathElement; path: number[] }): boolean {
  const rowPath = selected.path.slice(0, -1)
  const index = selected.path[selected.path.length - 1]
  const row = rowPath.length ? Node.get(editor, rowPath) : undefined
  const formula = { type: 'math-block' as const, latex: selected.node.latex, children: [{ text: '' }] }
  // A display formula cannot live inside a list item or another inline row, so
  // move it out right after that row instead of rewriting the row's structure.
  if (!rowPath.length || !Element.isElement(row) || row.type !== 'paragraph') {
    const after = rowPath.length ? [...rowPath.slice(0, -1), rowPath[rowPath.length - 1] + 1] : [0]
    withHistoryBatch(editor, () => Editor.withoutNormalizing(editor, () => {
      Transforms.removeNodes(editor, { at: selected.path })
      Transforms.insertNodes(editor, formula, { at: after, select: true })
    }))
    editSelectedMath(editor)
    return true
  }
  const { children: _children, type: _type, ...meta } = row as typeof row & Record<string, unknown>
  const before = row.children.slice(0, index) as Descendant[]
  const after = row.children.slice(index + 1) as Descendant[]
  const keepBefore = hasVisibleContent(before), keepAfter = hasVisibleContent(after)
  const depth = meta.__blockDepth !== undefined ? { __blockDepth: meta.__blockDepth } : {}
  // Normalizing between nodes would insert caret paragraphs between two voids.
  withHistoryBatch(editor, () => Editor.withoutNormalizing(editor, () => {
    Transforms.removeNodes(editor, { at: rowPath })
    const nodes: Descendant[] = []
    if (keepBefore) nodes.push({ ...meta, type: 'paragraph', children: withTextEdges(before) } as Descendant)
    nodes.push(keepBefore ? formula : { ...meta, ...formula } as Descendant)
    if (keepAfter) nodes.push({ ...depth, type: 'paragraph', children: withTextEdges(after) } as Descendant)
    Transforms.insertNodes(editor, nodes, { at: rowPath })
    const blockPath = keepBefore ? [...rowPath.slice(0, -1), rowPath[rowPath.length - 1] + 1] : rowPath
    Transforms.select(editor, Editor.start(editor, blockPath))
  }))
  editSelectedMath(editor)
  return true
}

/** Switch a display formula back into the text flow of a paragraph. */
function blockToInline(editor: Editor, selected: { node: MathElement; path: number[] }): boolean {
  const { type: _type, latex, children: _children, ...meta } = selected.node
  withHistoryBatch(editor, () => Editor.withoutNormalizing(editor, () => {
    Transforms.removeNodes(editor, { at: selected.path })
    Transforms.insertNodes(editor, { ...meta, type: 'paragraph',
      children: [{ text: '' }, { type: 'math-inline', latex, children: [{ text: '' }] }, { text: '' }] }, { at: selected.path })
    Transforms.select(editor, Editor.start(editor, [...selected.path, 1]))
  }))
  editSelectedMath(editor)
  return true
}

function insertInline(editor: Editor, fromMenu = false): boolean {
  if (!canInsertMath(editor)) return false
  // Only a formula covered on its own toggles or edits; a wider selection is
  // converted from its mixed text and formula source instead.
  const inline = selectedInlineMath(editor)
  if (inline) {
    if (fromMenu) editMath(editor, Node.get(editor, inline) as MathElement)
    else withHistoryBatch(editor, () => restoreInlineMathText(editor, inline))
    return true
  }
  const block = selectedMathBlock(editor)
  if (block) return blockToInline(editor, block)
  const latex = mathSelectionSource(editor)
  HistoryEditor.withNewBatch(editor, () => Editor.withoutNormalizing(editor, () => {
    materializeTextBoundary(editor)
    Transforms.insertNodes(editor, { type: 'math-inline', latex, children: [{ text: '' }] }, { select: true })
  }))
  editSelectedMath(editor)
  return true
}

export function canInsertBlockMath(editor: Editor): boolean {
  if (!canInsertMath(editor)) return false
  const tables = Editor.nodes(editor, { match: node => Element.isElement(node) && node.type === 'table' })
  return !!tables.next().done
}

function insertBlock(editor: Editor): boolean {
  if (!canInsertBlockMath(editor)) return false
  const block = selectedMathBlock(editor)
  if (block) { editMath(editor, block.node); return true }
  const inline = selectedInlineMath(editor)
  if (inline) return inlineToBlock(editor, { node: Node.get(editor, inline) as MathElement, path: inline })
  const latex = mathSelectionSource(editor)
  const formula = { type: 'math-block' as const, latex, children: [{ text: '' }] }
  withHistoryBatch(editor, () => {
    const point = editor.selection?.anchor
    const at = point && [point.path[0]]
    const row = at && Node.get(editor, at)
    if (at && Element.isElement(row) && row.type === 'paragraph' &&
        Range.isCollapsed(editor.selection!) && row.children.every(child => Text.isText(child) && !child.text.trim())) {
      Transforms.removeNodes(editor, { at })
      Transforms.insertNodes(editor, { ...formula,
        ...(row.__blockDepth !== undefined ? { __blockDepth: row.__blockDepth } : {}),
        ...(row.__blockId ? { __blockId: row.__blockId } : {}),
      }, { at, select: true })
    } else {
      Transforms.insertNodes(editor, formula, { mode: 'highest', select: true })
    }
  })
  editSelectedMath(editor)
  return true
}

export const MathPlugin = createPlugin<MathPluginCustomTypes>((editor, _options, { createPolicy }) => {
  editor.math = { insertInline: fromMenu => insertInline(editor, fromMenu), insertBlock: () => insertBlock(editor) }
  // The formula is a void, but its leaf carries the text marks so color,
  // highlight, underline and the other styles apply to the formula itself.
  const markableVoid = editor.markableVoid.bind(editor)
  editor.markableVoid = element => element.type === "math-inline" || markableVoid(element)
  withHeadingMathPolicy(editor)
  return createPolicy({
    name: "math",
    editor: {
      isInline: element => element.type === "math-inline" ? true : undefined,
      isVoid: element => isMath(element) ? true : undefined,
    },
    editableProps: {
      renderElement: props => isMath(props.element) ? <MathFormula {...props} element={props.element} /> : undefined,
      onKeyDown: event => {
        if (!['Enter', ' '].includes(event.key) || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing || editor.wysimark.readOnly) return false
        const entry = Editor.above<MathElement>(editor, { match: isMath })
        if (!entry) return false
        event.preventDefault(); editMath(editor, entry[0]); return true
      },
    },
  })
}) as TypedPlugin<MathPluginCustomTypes>
