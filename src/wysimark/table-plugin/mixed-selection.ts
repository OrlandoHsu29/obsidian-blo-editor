import { Editor, Element, Node, Path, Point, Range, Transforms } from 'slate'
import { withHistoryBatch } from '../utils/with-history-batch'

const isTable = (node: unknown) => Element.isElement(node) && node.type === 'table'
const tablePathAt = (editor: Editor, point: Point) => Editor.above(editor, { at: point, match: isTable })?.[1]

/** A selection crossing a table boundary includes the table as a block. */
export function expandMixedTableRange(editor: Editor, range: Range): Range {
  if (Range.isCollapsed(range)) return range
  const [start, end] = Range.edges(range)
  const first = tablePathAt(editor, start), last = tablePathAt(editor, end)
  if (first && last && Path.equals(first, last)) return range
  const from = first ? Editor.start(editor, first) : start
  const to = last ? Editor.end(editor, last) : end
  if (Point.equals(from, start) && Point.equals(to, end)) return range
  return Range.isBackward(range) ? { anchor: to, focus: from } : { anchor: from, focus: to }
}

export function mixedRangeCoversTable(editor: Editor, path: Path, range: Range): boolean {
  const [start, end] = Range.edges(range)
  const startsInside = Path.isAncestor(path, start.path), endsInside = Path.isAncestor(path, end.path)
  return !(startsInside && endsInside) && Path.compare(start.path, path) <= 0 && Path.compare(end.path, path) >= 0 &&
    (!startsInside || Editor.isStart(editor, start, path)) && (!endsInside || Editor.isEnd(editor, end, path))
}

/** Remove endpoint tables explicitly so Slate cannot merge into a cell. */
export function deleteMixedTableSelection(editor: Editor, afterDelete?: () => void): boolean {
  const selection = editor.selection
  if (!selection || Range.isCollapsed(selection) || editor.wysimark?.readOnly) return false
  const [start, end] = Range.edges(selection)
  const first = tablePathAt(editor, start), last = tablePathAt(editor, end)
  if ((!first && !last) || (first && last && Path.equals(first, last))) return false

  const range = expandMixedTableRange(editor, selection)
  const paths = Array.from(Editor.nodes(editor, { at: range, match: isTable, mode: 'highest' }), ([, path]) => path)
  let from = first ? Editor.after(editor, first) : start
  let to = last ? Editor.before(editor, last) : end
  // Adjacent endpoint tables may have no text between them.
  while (from && Point.compare(from, end) <= 0) {
    const path = tablePathAt(editor, from)
    if (!path) break
    from = Editor.after(editor, path)
  }
  while (to && Point.compare(to, start) >= 0) {
    const path = tablePathAt(editor, to)
    if (!path) break
    to = Editor.before(editor, path)
  }

  withHistoryBatch(editor, () => {
    const left = from && Editor.pointRef(editor, from)
    const right = to && Editor.pointRef(editor, to)
    try {
      for (const path of paths.reverse()) Transforms.removeNodes(editor, { at: path })
      const anchor = left?.current, focus = right?.current
      if (anchor && focus && Point.compare(anchor, focus) < 0) {
        Transforms.select(editor, { anchor, focus })
        Transforms.delete(editor, { hanging: true })
      } else {
        const caret = anchor ?? focus
        if (caret) Transforms.select(editor, caret)
        else {
          const firstText = Node.texts(editor).next().value
          if (firstText) Transforms.select(editor, { path: firstText[1], offset: 0 })
          else Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] }, { at: [0], select: true })
        }
      }
    } finally {
      left?.unref()
      right?.unref()
    }
    afterDelete?.()
  })
  return true
}
