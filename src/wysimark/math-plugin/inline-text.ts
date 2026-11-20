import { Editor, Element, Node, Path, Point, Range, Transforms } from 'slate'
import type { Location } from 'slate'
import { editMath } from './editing'
import type { InlineMathElement } from './types'

const isInlineMath = (node: Node): node is InlineMathElement => Element.isElement(node) && node.type === 'math-inline'

/** A clicked void or a range covering only that formula can toggle back to source. */
export function selectedInlineMath(editor: Editor): Path | undefined {
  const selection = editor.selection
  if (!selection) return
  if (Range.isCollapsed(selection)) return Editor.above(editor, { match: isInlineMath })?.[1]
  const [start, end] = Range.edges(selection)
  const [entry] = Editor.nodes(editor, { at: selection, match: isInlineMath, voids: true })
  if (!entry) return
  const path = entry[1]
  const before = Editor.before(editor, path) ?? Editor.start(editor, path)
  const after = Editor.after(editor, path) ?? Editor.end(editor, path)
  if (Point.compare(start, before) >= 0 && Point.compare(end, after) <= 0) return path
}

/** Replace formula nodes with unmarked text and leave neighboring Slate content intact. */
export function restoreInlineMathText(editor: Editor, at: Location): void {
  const entries = [...Editor.nodes<InlineMathElement>(editor, { at, match: isInlineMath, voids: true })]
  if (!entries.length) return
  editMath(editor)
  Editor.withoutNormalizing(editor, () => {
    for (const [formula, path] of entries.reverse()) {
      const selection = editor.selection
      const anchorInside = selection && Path.isAncestor(path, selection.anchor.path)
      const focusInside = selection && Path.isAncestor(path, selection.focus.path)
      Transforms.removeNodes(editor, { at: path })
      Transforms.insertNodes(editor, { text: formula.latex }, { at: path })
      if (selection && editor.selection && (anchorInside || focusInside)) {
        const start = { path, offset: 0 }, end = { path, offset: formula.latex.length }
        const backward = Range.isBackward(selection), collapsed = Range.isCollapsed(selection)
        Transforms.select(editor, {
          anchor: anchorInside ? collapsed || backward ? end : start : editor.selection.anchor,
          focus: focusInside ? backward ? start : end : editor.selection.focus,
        })
      }
    }
  })
}
