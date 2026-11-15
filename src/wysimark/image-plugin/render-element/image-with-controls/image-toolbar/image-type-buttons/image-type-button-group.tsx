import { $ImageButtonGroup } from "../../../../styles/image-with-controls-styles/image-buttons-styles"
import { ImageBlockElement, ImageInlineElement } from "../../../../types"
import { InlineImageTypeButton } from "./inline-image-type-button"

export function ImageTypeButtonGroup({
  element,
}: {
  element: ImageBlockElement | ImageInlineElement
}) {
  if (element.type === 'image-block') return null
  return (
    <$ImageButtonGroup>
      <InlineImageTypeButton element={element} />
    </$ImageButtonGroup>
  )
}
