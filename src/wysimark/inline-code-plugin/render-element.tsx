import { useLayoutEffect } from 'react'
import { Path, Range } from 'slate'
import { ReactEditor, RenderElementProps, useSlateSelection, useSlateStatic } from 'slate-react'
import { $InlineCode } from './styles'
import type { InlineCodeElement } from './types'


export function InlineCode({ element, attributes, children }: Omit<RenderElementProps, 'element'> & { element: InlineCodeElement }) {
  const editor = useSlateStatic()
  const selection = useSlateSelection()
  const empty = element.children.every(text => text.text === '')

  useLayoutEffect(() => {
    if (editor.wysimark.readOnly || !selection || !Range.isCollapsed(selection) ||
      !ReactEditor.isFocused(editor) || ReactEditor.isComposing(editor)) return
    const path = ReactEditor.findPath(editor, element)
    if (!empty || !Path.isAncestor(path, selection.anchor.path)) return
    const range = ReactEditor.toDOMRange(editor, selection)
    const native = range.startContainer.ownerDocument?.getSelection()
    if (native && (native.anchorNode !== range.startContainer || native.anchorOffset !== range.startOffset ||
      native.focusNode !== range.endContainer || native.focusOffset !== range.endOffset)) {
      native.setBaseAndExtent(range.startContainer, range.startOffset, range.endContainer, range.endOffset)
    }
  }, [editor, element, empty, selection])

  return <$InlineCode {...attributes} data-inline-code spellCheck={false}>
    {/* Keep Chromium from merging the editable positions inside and outside the code. */}
    <span contentEditable={false} aria-hidden style={{ fontSize: 0 }}>{'\u00a0'}</span>
    {children}
    <span contentEditable={false} aria-hidden style={{ fontSize: 0 }}>{'\u00a0'}</span>
  </$InlineCode>
}
