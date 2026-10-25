import { Editor, Location, Node, Point, Range, Text } from "slate"

/**
 * Toggles a mark.
 *
 * Certain marks may not be able to co-exist with another mark. For example,
 * superscript and subscript cannot be applied at the same time. In these
 * cases, you can provide a final argument of `unsetKey` that when the mark
 * is toggled on, the `unsetKey` mark is toggled off automatically. When the
 * mark is toggled off, it will ignore the `unsetKey`
 */

export function toggleMark(
  editor: Editor,
  markKey: keyof Text,
  unsetKey?: keyof Text,
  { at = editor.selection }: { at?: Location | null } = {}
) {
  if (at == null) return

  // Check if selection is at end of line
  const point = Range.isRange(at) ? at.focus : at
  const isAtLineEnd = Point.isPoint(point) && (
    Editor.after(editor, point) === null || 
    Editor.isEnd(editor, point, Editor.end(editor, []))
  )

  const validMarkKey = markKey
  const marks = Editor.marks(editor) || {}
  const selectedLeaves = Range.isRange(at) && Range.isExpanded(at)
    ? Editor.fragment(editor, at).flatMap(node => Array.from(Node.texts(node)).map(([leaf]) => leaf)).filter(leaf => leaf.text.length > 0)
    : []
  const isActive = selectedLeaves.length
    ? selectedLeaves.every(leaf => leaf[validMarkKey] === true)
    : marks[validMarkKey] === true

  // Store mark state for next insert if at line end
  // Inline code ends at its own boundary; it must never be reapplied by the
  // separate sticky-style state after deletion or moving to another block.
  const stickyMark = (['bold', 'italic', 'underline', 'strike', 'highlight'] as const).find(key => key === markKey)
  if (isAtLineEnd && stickyMark) {
    if (!isActive) {
      // Turning mark on
      editor.activeMarks = {
        ...editor.activeMarks,
        [stickyMark]: true
      }
    } else {
      // Turning mark off
      const { [stickyMark]: _unused, ...remainingMarks } = editor.activeMarks || {}
      void _unused
      editor.activeMarks = remainingMarks
    }
  }

  // Toggle mark in current selection
  if (isActive) {
    Editor.removeMark(editor, validMarkKey)
  } else {
    Editor.addMark(editor, validMarkKey, true)
  }

  // Handle unset key if provided
  if (typeof unsetKey === "string") {
    Editor.removeMark(editor, unsetKey)
  }
}
