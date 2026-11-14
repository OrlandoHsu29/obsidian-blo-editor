import { Element, Node, Path } from 'slate'
import { useRef } from 'react'
import { ReactEditor, useSlateStatic } from 'slate-react'
import type { RenderTextProps } from 'slate-react/dist/components/editable'

function LinkCaretBoundary({ text }: { text: string }) {
  const version = useRef({ text, revision: 0 })
  if (version.current.text !== text) version.current = { text, revision: version.current.revision + 1 }
  return <span data-slate-leaf="true" key={version.current.revision}>
    <span data-slate-zero-width="z" data-slate-length="0">{'\uFEFF'}</span>
  </span>
}

function LinkInputText({ text, attributes, children }: RenderTextProps) {
  const editor = useSlateStatic()
  const path = text.text ? ReactEditor.findPath(editor, text) : undefined
  const previous = path && path.at(-1)! > 0 ? Node.get(editor, Path.previous(path)) : undefined
  const afterLink = !!text.text && Element.isElement(previous) && previous.type === 'anchor'
  return <span {...attributes}>
    {/* Reuse Slate's zero-length DOM boundary. It is not part of the document.
        A new text value remounts the marker, clearing native composition text. */}
    {afterLink && <LinkCaretBoundary text={text.text} />}
    {children}
  </span>
}

export const renderLinkInputText = (props: RenderTextProps) => <LinkInputText {...props} />
