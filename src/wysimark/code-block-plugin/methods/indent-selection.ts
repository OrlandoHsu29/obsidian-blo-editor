import { Editor, Element, Path, Point, Range, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'

/** Indent code text without changing the containing block's depth. */
export function indentCodeSelection(editor: Editor, delta: 1 | -1): boolean {
  const { selection } = editor
  if (editor.wysimark.readOnly || !selection) return false
  const [start, end] = Range.edges(selection)
  const entry = Editor.above(editor, {
    at: start,
    match: node => Element.isElement(node) && node.type === 'code-block',
  })
  if (!entry || !Path.isAncestor(entry[1], end.path)) return false
  const path = entry[1], first = start.path[path.length]
  let last = end.path[path.length]
  if (Range.isExpanded(selection) && last > first &&
      Point.equals(end, Editor.start(editor, [...path, last]))) last--
  const run = () => Editor.withoutNormalizing(editor, () => {
    if (delta > 0 && Range.isCollapsed(selection)) {
      Transforms.insertText(editor, '    ')
      return
    }
    const saved = Editor.rangeRef(editor, selection, { affinity: 'inward' })
    try {
      for (let line = first; line <= last; line++) {
        const at = Editor.start(editor, [...path, line])
        if (delta > 0) Transforms.insertText(editor, '    ', { at })
        else {
          const prefix = /^(?:\t| {1,4})/.exec(Editor.string(editor, [...path, line]))?.[0]
          if (prefix) Transforms.delete(editor, { at: { anchor: at,
            focus: Editor.after(editor, at, { distance: prefix.length })! } })
        }
      }
    } finally {
      const range = saved.unref()
      if (range) Transforms.select(editor, range)
    }
  })
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, run)
  else run()
  return true
}
