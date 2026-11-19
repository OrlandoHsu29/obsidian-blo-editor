import { ConstrainedRenderElementProps } from "../../sink"

import { ImageBlockElement, ImageInlineElement, ImageRowCaretElement, ImageRowElement } from "../types"
import { ReactEditor, useSlateStatic } from 'slate-react'
import { Editor, Transforms } from 'slate'
import { ImageBlock } from "./image-block"
import { ImageInline } from "./image-inline"
import { ImageRow } from './image-row'

export function renderElement({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<ImageBlockElement | ImageInlineElement | ImageRowElement | ImageRowCaretElement>) {
  switch (element.type) {
    case 'image-row':
      return <ImageRow element={element} attributes={attributes}>{children}</ImageRow>
    case 'image-row-caret':
      return <ImageRowCaret element={element} attributes={attributes}>{children}</ImageRowCaret>
    case "image-block":
      return (
        <ImageBlock element={element} attributes={attributes}>
          {children}
        </ImageBlock>
      )
    case "image-inline":
      return (
        <ImageInline element={element} attributes={attributes}>
          {children}
        </ImageInline>
      )
  }
}

function ImageRowCaret({element,attributes,children}:ConstrainedRenderElementProps<ImageRowCaretElement>) {
  const editor = useSlateStatic()
  return <div {...attributes} data-blo-image-gap onMouseDown={event => {
    if (editor.wysimark.readOnly || event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
    event.preventDefault(); event.stopPropagation()
    const path = ReactEditor.findPath(editor,element)
    ReactEditor.focus(editor)
    Transforms.select(editor,Editor.start(editor,path))
  }}>{children}</div>
}
