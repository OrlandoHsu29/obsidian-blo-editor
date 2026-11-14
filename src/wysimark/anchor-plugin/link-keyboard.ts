import { Editor, Element, Node, Path, Point, Range, Text, Transforms } from 'slate'

const isAnchor = (node: Node) => Element.isElement(node) && node.type === 'anchor'
/** Blank AI citations still have a visible link icon, even with no Slate text. */
export const isIconOnlyLink = (node: Node) => isAnchor(node) && /^[\s\u200b\u200c\u200d\u2060\ufeff]*$/u.test(Node.string(node))
const emptySelections = new WeakMap<Editor, { node: Node; path: Path; range: Range }>()

function outsideLink(editor: Editor, path: Path, before: boolean): Point {
  const sibling = before ? path.at(-1)! > 0 ? Path.previous(path) : undefined : Path.next(path)
  if (sibling && Node.has(editor, sibling) && Text.isText(Node.get(editor, sibling))) {
    return before ? Editor.end(editor, sibling) : Editor.start(editor, sibling)
  }
  return before ? Editor.start(editor, path) : Editor.end(editor, path)
}

export const pointBeforeLink = (editor: Editor, path: Path) => outsideLink(editor, path, true)

/** The icon lies before the label, independently of how much text is selected. */
export function isLinkIconSelected(editor: Editor, path: Path, range = editor.selection): boolean {
  if (!range || Range.isCollapsed(range)) return false
  const [start, end] = Range.edges(range)
  return Point.compare(start, outsideLink(editor, path, true)) <= 0 && Point.compare(end, Editor.start(editor, path)) >= 0
}

export function isLinkFullySelected(editor: Editor, path: Path, range = editor.selection): boolean {
  if (!range || Range.isCollapsed(range)) return false
  const [start, end] = Range.edges(range)
  return Point.compare(start, outsideLink(editor, path, true)) <= 0 && Point.compare(end, Editor.end(editor, path)) >= 0
}

/** Only a range that actually includes the icon may remove the link node. */
export function completeLinkSelection(editor: Editor): Range | undefined {
  const range = editor.selection
  if (!range || Range.isCollapsed(range)) return
  const end = Range.end(range), link = Editor.above(editor, {at:end,match:isAnchor})
  if (!link || !isLinkFullySelected(editor,link[1],range)) return
  const outside = outsideLink(editor,link[1],false)
  return Range.isBackward(range) ? {...range,anchor:outside} : {...range,focus:outside}
}

export function selectLink(editor: Editor, path: Path): void {
  const node = Node.get(editor, path), range = {anchor:outsideLink(editor,path,true),focus:outsideLink(editor,path,false)}
  if (Range.isCollapsed(range)) emptySelections.set(editor, { node, path, range })
  else emptySelections.delete(editor)
  Transforms.select(editor, range)
}

/** Find the link ending at the caret, including Slate's empty inline boundary. */
function linkBeforeCaret(editor: Editor, at?: Point): Path | undefined {
  const selection = editor.selection
  if (!at && (!selection || !Range.isCollapsed(selection))) return
  const point = at ?? selection!.anchor
  const inside = Editor.above(editor, { at: point, match: isAnchor })
  if (inside && Point.equals(point, Editor.end(editor, inside[1]))) return inside[1]
  if (inside || point.offset !== 0 || point.path[point.path.length - 1] === 0) return
  const previous = Path.previous(point.path)
  if (Node.has(editor, previous) && isAnchor(Node.get(editor, previous))) return previous
}

/** Both caret representations at a link's right edge mean plain text input. */
export function pointAfterLinkAtEnd(editor: Editor, range = editor.selection): Point | undefined {
  if (!range || !Range.isCollapsed(range)) return
  const path = linkBeforeCaret(editor, range.anchor)
  // Replacing a selected label temporarily leaves an empty link. That is an
  // editing position, rather than the visible right edge of an existing label.
  if (path && Path.isAncestor(path, range.anchor.path) && Node.string(Node.get(editor, path)) === '') return
  if (path) return outsideLink(editor, path, false)
}

/** Find the link beginning at the caret, including Slate's inline boundary. */
function linkAfterCaret(editor: Editor, at?: Point): Path | undefined {
  const selection = editor.selection
  const point = at ?? (selection && Range.isCollapsed(selection) ? selection.anchor : undefined)
  if (!point) return
  const inside = Editor.above(editor, { at: point, match: isAnchor })
  if (inside && Point.equals(point, Editor.start(editor, inside[1]))) return inside[1]
  if (inside || point.offset !== Editor.leaf(editor, point)[0].text.length) return
  const next = Path.next(point.path)
  if (Node.has(editor, next) && isAnchor(Node.get(editor, next))) return next
}

export function selectedLink(editor: Editor): Path | undefined {
  const selection = editor.selection
  if (!selection) return
  const empty = emptySelections.get(editor)
  if (empty) {
    if (Range.equals(selection, empty.range) && Node.has(editor, empty.path) && Node.get(editor, empty.path) === empty.node) return empty.path
    emptySelections.delete(editor)
  }
  if (Range.isCollapsed(selection)) return
  const path = linkAfterCaret(editor, Range.start(selection))
  if (path) {
    const ordered = {anchor:Range.start(selection),focus:Range.end(selection)}
    const whole = {anchor:outsideLink(editor,path,true),focus:outsideLink(editor,path,false)}
    if (Range.equals(ordered, whole)) return path
  }
}

/** Return true only for a link operation handled here. */
export function handleLinkKey(editor: Editor, key: string): boolean {
  if (editor.wysimark.readOnly || !editor.selection || !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight'].includes(key)) return false
  const selected = selectedLink(editor)
  if (selected) {
    emptySelections.delete(editor)
    if (key === 'Backspace' || key === 'Delete') {
      Transforms.removeNodes(editor, { at: selected })
    } else {
      const target = outsideLink(editor, selected, key === 'ArrowLeft')
      Transforms.select(editor, target)
    }
    return true
  }
  const link = key === 'ArrowRight' || key === 'Delete' ? linkAfterCaret(editor) : linkBeforeCaret(editor)
  if (!link) return false
  // The shared right-edge caret is outside the link. Moving left must skip its
  // equivalent inside endpoint, otherwise selection canonicalization traps it.
  if (key === 'ArrowLeft' && !Path.isAncestor(link, editor.selection.anchor.path) && !isIconOnlyLink(Node.get(editor, link))) {
    const point = Editor.before(editor, Editor.end(editor, link), { unit: 'character' })
    if (point && Path.isAncestor(link, point.path)) { Transforms.select(editor, point); return true }
  }
  // Visible link text uses Slate's normal caret navigation and deletion.
  // Only icon-only links need atomic two-step selection, including empty ones.
  if (!isIconOnlyLink(Node.get(editor, link))) return false
  selectLink(editor, link)
  return true
}
