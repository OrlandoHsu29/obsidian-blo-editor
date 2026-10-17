import { ui } from "../../../../../utils/translations"
import { useCallback } from "react"
import { useSlateStatic } from "slate-react"

import { tooltipLabel } from "../../../../../use-tooltip"

import { $ImageButton } from "../../../../styles/image-with-controls-styles/image-buttons-styles"
import { ImageBlockElement, ImageInlineElement } from "../../../../types"
import { BlockIcon } from "../../../icons"
import { convertToBlockImage } from "./convert-to-block-image"

export function InlineImageTypeButton({
  element,
}: {
  element: ImageBlockElement | ImageInlineElement
}) {
  const editor = useSlateStatic()
  const tooltip = tooltipLabel({
    title: ui("Block Image"),
    hotkey: "On a line by itself",
  })

  const onClickBlock = useCallback(() => {
    if (element.type !== "image-inline") return
    convertToBlockImage(editor, element)
  }, [editor, element])

  return (
    <$ImageButton
      className={element.type === "image-block" ? "--selected" : ""}
      onClick={element.type === "image-block" ? undefined : onClickBlock}
      aria-label={tooltip}
          data-tooltip-position="top"
    >
      <BlockIcon />
    </$ImageButton>
  )
}
