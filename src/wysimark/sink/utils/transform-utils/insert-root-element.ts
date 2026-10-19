import { Editor, Element, Location, Path, Point, Range, Text, Transforms } from "slate"
import { HistoryEditor } from "slate-history"

import { findElementUp } from "../.."

/**
 * Inserts an Element into the document such that if it is in a `isMaster`
 * element (i.e. an Element that has a number of dependants like a table or
 * code block) then then inserted Element will appear after the `isMaster`
 * element.
 *
 * This prevents invalid states from happening like inserting a table inside
 * a table, or a code block in a table, or a table in a code block.
 */
export function insertRootElement(
  editor: Editor,
  element: Element,
  { at = editor.selection, select = false }: {
    at?: Location | null
    select?: boolean
  } = {}
): boolean {
  /**
   * If there's no `at` then insertion does not happen
   */
  if (at == null) return false
  const entry = findElementUp(
    editor,
    (node) => Element.isElement(node) && editor.isMaster(node)
  )
  const point = Point.isPoint(at) ? at : Range.isRange(at) && Range.isCollapsed(at) ? at.anchor : null
  const empty = point && Editor.above(editor, {
    at: point,
    match: node => Element.isElement(node) && node.type === 'paragraph' &&
      node.children.every(child => Text.isText(child) && child.text === ''),
  })
  if (empty && !entry) {
    const [paragraph, path] = empty
    const replacement = element.__blockDepth === undefined && Element.isElement(paragraph) && paragraph.__blockDepth !== undefined
      ? { ...element, __blockDepth: paragraph.__blockDepth } : element
    const replace = () => Editor.withoutNormalizing(editor, () => {
      Transforms.removeNodes(editor, { at: path })
      Transforms.insertNodes(editor, replacement, { at: path })
      Transforms.select(editor, Editor.start(editor, path))
      editor.marks = null
    })
    if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, replace)
    else replace()
    return true
  }
  /**
   * Look for a parent that `isMaster`
   */
  if (entry == null) {
    /**
     * If not `isMaster` then do a regular insert, select the original
     * insertion point and move forward to select the first position inside
     * the newly inserted element.
     */
    const selection = editor.selection
    Editor.withoutNormalizing(editor, () => {
      Transforms.insertNodes(editor, element, { at, select })
      // Selecting the inserted node avoids restoring paths removed by a
      // replacement spanning several blocks.
      if (selection && !select) {
        Transforms.select(editor, selection)
        Transforms.move(editor)
      }
    })
  } else {
    /**
     * If it `isMaster` then find the next adjacent path to the master, insert
     * there, and then select at the start of the insertion point.
     */
    const nextPath = Path.next(entry[1])
    Editor.withoutNormalizing(editor, () => {
      Transforms.insertNodes(editor, element, { at: nextPath })
      Transforms.select(editor, Editor.start(editor, nextPath))
    })
  }
  return true
}
