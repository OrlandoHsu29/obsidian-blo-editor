import type { MouseEvent } from 'react'
import type { Editor } from 'slate'
import { ReactEditor } from 'slate-react'
import { rootCache } from './model'
import { selectStructuredBoundary } from './boundary'
import { clearBlockSelection } from './selection'
import { structuredBlockContent, structuredBlockSelector } from './structured-block'
import { startPointerSelection } from './pointer-selection'

/** Catch the right page gutter before Slate resolves it to a table cell. */
export function selectBoundaryFromPointer(editor: Editor, event: MouseEvent<HTMLElement>): boolean {
  if (editor.wysimark.readOnly || event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false
  const target = event.target as HTMLElement
  if (target.closest('button,input,textarea,select,[role="menu"],[data-wysimark-toolbar],[data-wysimark-image-resize]')) return false
  const direct = target.closest<HTMLElement>('[data-wysimark-block]')
  const candidates: HTMLElement[] = []
  if (direct) candidates.push(direct)
  else {
    const document = event.currentTarget.ownerDocument
    const probe = document.elementFromPoint(Math.max(0, event.clientX - 64), event.clientY)
    const block = probe?.closest<HTMLElement>('[data-wysimark-block]')
    if (block) candidates.push(block)
    const local = target.closest('.ks-editor-chunk-leaf')
    const chunks = local ? [local] : Array.from(event.currentTarget.querySelectorAll('.ks-editor-chunk-leaf'))
    for (const chunk of chunks) {
      const bounds = chunk.getBoundingClientRect()
      if (event.clientY < bounds.top || event.clientY > bounds.bottom) continue
      candidates.push(...chunk.querySelectorAll<HTMLElement>(structuredBlockSelector))
    }
  }
  for (const block of candidates) {
    if (!event.currentTarget.contains(block)) continue
    const content = structuredBlockContent(block)
    if (!content) continue
    const bounds = content.getBoundingClientRect()
    if (event.clientX < bounds.right - 1 || event.clientY < bounds.top || event.clientY > bounds.bottom) continue
    const node = ReactEditor.toSlateNode(editor, content.closest('[data-slate-node="element"]') || content)
    const index = rootCache(editor).indices.get(node)
    if (index === undefined) continue
    event.preventDefault(); event.stopPropagation()
    clearBlockSelection(editor)
    if (selectStructuredBoundary(editor, index)) {
      if (event.type === 'mousedown' && editor.selection) startPointerSelection(editor, editor.selection.anchor, event)
      else ReactEditor.focus(editor)
    }
    return true
  }
  return false
}
