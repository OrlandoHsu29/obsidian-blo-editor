import { ui } from "../../../../../utils/translations"
import { useCallback } from "react"
import { useSlateStatic } from "slate-react"

import { tooltipLabel } from "../../../../../use-tooltip"

import { $ImageButton } from "../../../../styles/image-with-controls-styles/image-buttons-styles"
import { ImageBlockElement, ImageInlineElement } from "../../../../types"
import { InlineIcon } from "../../../icons"
import { convertToInlineImage } from "./convert-to-inline-image"

export function BlockImageTypeButton({
  element,
}: {
  element: ImageBlockElement | ImageInlineElement
}) {
  const editor = useSlateStatic()
  const tooltip = tooltipLabel({
    title: ui("Inline Image"),
    hotkey: "In a line with text",
  })

  const onClickInline = useCallback(() => {
    if (element.type !== "image-block") return
    convertToInlineImage(editor, element)
  }, [editor, element])
  return (
    <$ImageButton
      className={element.type === "image-inline" ? "--selected" : ""}
      onClick={element.type === "image-inline" ? undefined : onClickInline}
      aria-label={tooltip}
          data-tooltip-position="top"
    >
      <InlineIcon />
    </$ImageButton>
  )
}
