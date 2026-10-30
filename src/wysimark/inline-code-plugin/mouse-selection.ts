import type { MouseEvent } from 'react'
import { Editor, Element, Node, Point, Text } from 'slate'
import { ReactEditor } from 'slate-react'
import { startPointerSelection } from '../../blocks/pointer-selection'

/** Chromium loses its drag anchor when entering an inline from its left margin. */
export function startInlineCodeDrag(editor: Editor, event: MouseEvent<HTMLElement>): (() => void) | undefined {
  if (editor.wysimark.readOnly || event.button !== 0 || event.detail > 1 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target as HTMLElement
  const document = event.currentTarget.ownerDocument
  const hit = document.caretRangeFromPoint(event.clientX, event.clientY)
  const point = hit && ReactEditor.toSlatePoint(editor, [hit.startContainer, hit.startOffset], { exactMatch: false, suppressThrow: true })
  // The clickable area of a caret includes half of the preceding glyph. It is
  // wider than the CSS margin, and its size changes with zoom and font metrics.
  let boundaryCode: HTMLElement | undefined
  let boundaryPoint: Point | undefined
  if (point && Node.has(editor, point.path)) {
    const leaf = Node.get(editor, point.path)
    const next = [...point.path.slice(0, -1), point.path.at(-1)! + 1]
    const sibling = Node.has(editor, next) ? Node.get(editor, next) : undefined
    if (Text.isText(leaf) && Element.isElement(sibling) && sibling.type === 'inline-code') {
      const element = ReactEditor.toDOMNode(editor, sibling)
      if (event.clientX < element.getBoundingClientRect().left) {
        boundaryCode = element
        boundaryPoint = point
      }
    }
  }
  const text = target.closest('[data-slate-node="text"]')
  const parent = target.closest('[data-slate-node="element"]')
  const candidates = parent?.hasAttribute('data-inline-code') ? [parent]
    : text ? [text.nextElementSibling] : Array.from(parent?.children ?? [])
  const code = boundaryCode ?? candidates.find((node): node is HTMLElement => {
    if (!node?.hasAttribute('data-inline-code')) return false
    const box = node.getBoundingClientRect()
    const margin = parseFloat(node.ownerDocument.defaultView!.getComputedStyle(node).marginLeft) || 0
    return event.clientX >= box.left - margin - 1 && event.clientX < box.left &&
      event.clientY >= box.top && event.clientY <= box.bottom
  })
  if (!code) return
  const path = ReactEditor.findPath(editor, ReactEditor.toSlateNode(editor, code))
  const before = [...path.slice(0, -1), path.at(-1)! - 1]
  if (before.at(-1)! < 0 || !Node.has(editor, before) || !Text.isText(Node.get(editor, before))) return
  return startPointerSelection(editor, boundaryPoint ?? Editor.end(editor, before), event)
}
