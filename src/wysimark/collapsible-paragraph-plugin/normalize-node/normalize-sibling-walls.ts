import { Editor, Element, Node, NodeEntry, Path, Transforms } from "slate"

import { normalizeSiblings } from "../../sink"

function isWall(editor: Editor, node: Node) {
  if (!Element.isElement(node)) return false
  return editor.isVoid(node) || editor.isMaster(node)
}
/**
 * We want to create collapsible paragraphs in places where we can't easily
 * create them. For example, between two images.
 *
 * Currently, we look for elements that are
 *
 * - `isVoid` like images or
 * - `isMaster` like `table` and `code-block`.
 *
 * If there is nothing between them, we insert a collapsible paragraph.
 */

export function normalizeSiblingWalls(
  editor: Editor,
  entry: NodeEntry<Element>
): boolean {
  if (!isWall(editor, entry[0])) return false
  const parent = Node.get(editor, Path.parent(entry[1]))
  if (Element.isElement(parent) && parent.type === 'image-row') return false
  return normalizeSiblings(editor, entry, (a, b) => {
    if (!isWall(editor, a[0]) || !isWall(editor, b[0])) return false
    Transforms.insertNodes(
      editor,
      {
        type: "paragraph",
        __collapsible: true,
        children: [{ text: "" }],
      },
      { at: b[1] }
    )
    return true
  })
}
