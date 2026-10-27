import { Editor, Element, Node, Path, Point, Range, Transforms } from 'slate'

const isAnchor = (node: Node) => Element.isElement(node) && node.type === 'anchor'

/** Find the link ending at the caret, including Slate's empty inline boundary. */
function linkBeforeCaret(editor: Editor): Path | undefined {
  const selection = editor.selection
  if (!selection || !Range.isCollapsed(selection)) return
  const point = selection.anchor
  const inside = Editor.above(editor, { at: point, match: isAnchor })
  if (inside && Point.equals(point, Editor.end(editor, inside[1]))) return inside[1]
  if (inside || point.offset !== 0 || point.path[point.path.length - 1] === 0) return
  const previous = Path.previous(point.path)
  if (Node.has(editor, previous) && isAnchor(Node.get(editor, previous))) return previous
}

/** Find the link beginning at the caret, including Slate's inline boundary. */
function linkAfterCaret(editor: Editor): Path | undefined {
  const selection = editor.selection
  if (!selection || !Range.isCollapsed(selection)) return
  const point = selection.anchor
  const inside = Editor.above(editor, { at: point, match: isAnchor })
  if (inside && Point.equals(point, Editor.start(editor, inside[1]))) return inside[1]
  if (inside || point.offset !== Editor.leaf(editor, point)[0].text.length) return
  const next = Path.next(point.path)
  if (Node.has(editor, next) && isAnchor(Node.get(editor, next))) return next
}

function selectedLink(editor: Editor): Path | undefined {
  const selection = editor.selection
  if (!selection || Range.isCollapsed(selection)) return
  const link = Editor.above(editor, { at: Range.start(selection), match: isAnchor })
  if (link && Range.equals(Editor.range(editor, link[1]), { anchor: Range.start(selection), focus: Range.end(selection) })) return link[1]
}

/** Return true only for a link operation handled here. */
export function handleLinkKey(editor: Editor, key: string): boolean {
  if (!editor.selection || !['Backspace', 'ArrowLeft', 'ArrowRight'].includes(key)) return false
  const selected = selectedLink(editor)
  if (selected) {
    if (key === 'Backspace') {
      Transforms.removeNodes(editor, { at: selected })
    } else {
      const target = key === 'ArrowLeft' ? Editor.before(editor, selected) : Editor.after(editor, selected)
      if (!target) return false
      Transforms.select(editor, target)
    }
    return true
  }
  const link = key === 'ArrowRight' ? linkAfterCaret(editor) : linkBeforeCaret(editor)
  if (!link) return false
  const range = Editor.range(editor, link)
  if (Range.isCollapsed(range)) return false
  Transforms.select(editor, range)
  return true
}
