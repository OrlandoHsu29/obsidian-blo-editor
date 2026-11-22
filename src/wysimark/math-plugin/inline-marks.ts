import { Editor, Element, Node, Path, Point, Range, Text } from "slate"
import type { InlineMathElement } from "./types"

export const isInlineMathElement = (node: unknown): node is InlineMathElement =>
  Element.isElement(node) && (node as { type?: string }).type === "math-inline"

export type InlineMathLeaf = { leaf: Text; path: Path }

/**
 * Leaves of the inline formulas a range covers completely.
 *
 * Slate applies marks to markable voids on its own (`editor.markableVoid`), but
 * the color helpers walk text leaves and skip empty ones, so they need the
 * formula leaves explicitly.
 */
export function inlineMathLeaves(editor: Editor, at: Range | null = editor.selection): InlineMathLeaf[] {
  if (!at || !Range.isExpanded(at)) return []
  const result: InlineMathLeaf[] = []
  for (const [node, path] of Editor.nodes(editor, { at, match: isInlineMathElement, voids: true })) {
    const start = Editor.start(editor, path), end = Editor.end(editor, path)
    if (Point.compare(start, Range.start(at)) < 0 || Point.compare(end, Range.end(at)) > 0) continue
    // `Node.texts` paths are relative to the element, so prefix the element path.
    for (const [leaf, relative] of Node.texts(node)) result.push({ leaf, path: path.concat(relative) })
  }
  return result
}
