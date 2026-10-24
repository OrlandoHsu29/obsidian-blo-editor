import { useSlateStatic } from "slate-react"

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
  if (isWikiEmbedUrl(element.url) && editor.wysimark.renderInternalEmbed) {
    return (
      <div {...attributes}>
        <WikiEmbedView element={element} />
        <MediaReferenceDialog element={element} />
        {children}
      </div>
    )
  }
  return (
    <div {...attributes}>
      <$ImageBlock contentEditable={false}>
        <ImageWithControls
          element={element}
          presets={editor.image.imageBlockPresets}
        />
      </$ImageBlock>
      <MediaReferenceDialog element={element} />
      {children}
    </div>
  )
}
