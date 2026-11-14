import { useCallback } from 'react'
import { Editor, Element, Path, Point, Range } from 'slate'
import { ReactEditor, useSlateSelector } from 'slate-react'
import type { AnchorElement } from '..'
import { LinkSelection, linkSelection, noLinkSelection, selectedLink } from '../link-keyboard'

type CommonSelection = { expanded: boolean; precise: boolean }
type SelectionState = LinkSelection & CommonSelection
const common = new WeakMap<Editor, { selection: Editor['selection']; children: Editor['children']; value: CommonSelection }>()

/** Table/atomic selection is a document property, not something each link recomputes. */
function commonSelection(editor: Editor): CommonSelection {
  const cached = common.get(editor), selection = editor.selection
  if (cached && cached.selection === selection && cached.children === editor.children) return cached.value
  const expanded = !!selection && Range.isExpanded(selection)
  let precise = !!selection && !expanded
  if (expanded) {
    precise = !!selectedLink(editor)
    if (!precise) {
      const cell = Editor.above(editor, { at: selection!.anchor,
        match: node => Element.isElement(node) && node.type === 'table-cell' })?.[1]
      precise = !!cell && Path.isAncestor(cell, selection!.focus.path) && Range.equals(selection!, Editor.range(editor, cell))
    }
  }
  const value = { expanded, precise }
  common.set(editor, { selection, children: editor.children, value })
  return value
}

export function linkSelectionState(editor: Editor, path?: Path): SelectionState {
  return { ...(path ? linkSelection(editor, path) : noLinkSelection), ...commonSelection(editor) }
}

const sameRange = (a: Range | null, b: Range | null) => a === b || !!a && !!b && Range.equals(a, b)
const samePoint = (a: Point | null, b: Point | null) => a === b || !!a && !!b && Point.equals(a, b)
const sameSelection = (a: SelectionState | null, b: SelectionState | null) => a === b || !!a && !!b && a.expanded === b.expanded && a.precise === b.precise &&
  a.full === b.full && a.icon === b.icon && sameRange(a.text, b.text) && samePoint(a.start, b.start)

export function useLinkSelection(element: AnchorElement): SelectionState {
  return useSlateSelector(useCallback(editor => {
    if (!editor.selection || Range.isCollapsed(editor.selection)) return linkSelectionState(editor)
    try { return linkSelectionState(editor, ReactEditor.findPath(editor, element)) }
    catch { return linkSelectionState(editor) }
  }, [element]), sameSelection)
}
