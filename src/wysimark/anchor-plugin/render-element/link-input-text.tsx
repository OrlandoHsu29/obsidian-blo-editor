import { Element, Node, Path } from 'slate'
import { ReactEditor, useSlateStatic } from 'slate-react'
import type { RenderTextProps } from 'slate-react/dist/components/editable'

function LinkInputText({ text, attributes, children }: RenderTextProps) {
  const editor = useSlateStatic()
  const path = ReactEditor.findPath(editor, text)
  const previous = path.at(-1)! > 0 ? Node.get(editor, Path.previous(path)) : undefined
  const afterLink = !!text.text && Element.isElement(previous) && previous.type === 'anchor'
  return <span {...attributes}>
    {/* Reuse Slate's zero-length DOM boundary. It is not part of the document.
        A new text value remounts the marker, clearing native composition text. */}
    {afterLink && <span data-slate-leaf="true" key={text.text}>
      <span data-slate-zero-width="z" data-slate-length="0">{'\uFEFF'}</span>
    </span>}
    {children}
  </span>
}

export const renderLinkInputText = (props: RenderTextProps) => <LinkInputText {...props} />
