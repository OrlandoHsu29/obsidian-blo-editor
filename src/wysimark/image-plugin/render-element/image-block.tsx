import { useSlateStatic } from "slate-react"
import type { CSSProperties } from 'react'

import { ConstrainedRenderElementProps } from "../../sink"

import { isWikiEmbedUrl } from "../../convert/obsidian-links"
import { $ImageBlock } from "../styles/image-block-styles"
import { ImageBlockElement } from "../types"
import { ImageWithControls } from "./image-with-controls"
import { WikiEmbedView } from "./wiki-embed-view"
import { MediaReferenceDialog } from './media-reference-dialog'

export function ImageBlock({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<ImageBlockElement>) {
  const editor = useSlateStatic()
  const style = { '--blo-image-width': element.width ? `${element.width}px` :
    element.height ? `calc(${element.height}px * var(--blo-image-ratio,1))` : undefined } as CSSProperties
  if (isWikiEmbedUrl(element.url) && editor.wysimark.renderInternalEmbed) {
    return (
      <div {...attributes} data-blo-image-item style={style}>
        <WikiEmbedView element={element} />
        <MediaReferenceDialog element={element} />
        {children}
      </div>
    )
  }
  return (
    <div {...attributes} data-blo-image-item style={style}>
      <$ImageBlock contentEditable={false}>
        <ImageWithControls
          element={element}
        />
      </$ImageBlock>
      <MediaReferenceDialog element={element} />
      {children}
    </div>
  )
}
