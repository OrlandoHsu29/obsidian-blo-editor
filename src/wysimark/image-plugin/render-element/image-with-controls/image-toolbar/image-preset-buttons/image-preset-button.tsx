import { clsx } from "clsx"
import { getLanguage, ui } from '../../../../../utils/translations'
import { Dispatch, SetStateAction, useCallback } from "react"
import { Transforms } from "slate"
import { ReactEditor, useSlateStatic } from "slate-react"

import { tooltipLabel } from "../../../../../use-tooltip"

import { $ImageButton } from "../../../../styles/image-with-controls-styles/image-buttons-styles"
import {
  ImageBlockElement,
  ImageInlineElement,
  ImageSize,
  ImageSizePreset,
} from "../../../../types"
import { resizeInPreset } from "../../../../utils"

/**
 * Shows a single preset image sizes as defined by the `Preset` type.
 *
 * If the srcSize is smaller than the preset, clicking the preset would do
 * nothing except show the image at its full size. For this reason, the
 * preset is disabled if the srcSize is smaller than the preset.
 */
export function ImagePresetButton({
  element,
  preset,
  size,
  setSize,
  srcSize,
}: {
  element: ImageBlockElement | ImageInlineElement
  preset: ImageSizePreset
  size: ImageSize
  setSize: Dispatch<SetStateAction<ImageSize | null>>
  srcSize: ImageSize
}) {
  const editor = useSlateStatic()
  const presetSize = resizeInPreset(size, srcSize, preset)
  const tooltip = tooltipLabel({
    title: preset.title,
    hotkey: `${presetSize.width}x${presetSize.height}`,
  })

  const onClick = useCallback(() => {
    const path = ReactEditor.findPath(editor, element)
    const nextSize = resizeInPreset(size, srcSize, preset)
    setSize(nextSize)
    Transforms.setNodes(editor, { ...nextSize, srcWidth: srcSize.width, srcHeight: srcSize.height }, { at: path })
  }, [element, preset, size, srcSize])

  const isEnabled =
    preset.type === "scale"
      ? true
      : preset.width <= srcSize.width || preset.height <= srcSize.height

  const isDisabled = !isEnabled

  const isSelected =
    size.width === presetSize.width && size.height === presetSize.height

  const className = clsx({
    "--disabled": isDisabled,
    "--selected": !isDisabled && isSelected,
  })

  return (
    <$ImageButton
      data-wysimark-image-preset={preset.name}
      className={className}
      onClick={isDisabled ? undefined : onClick}
      aria-label={tooltip}
          data-tooltip-position="top"
    >
      {getLanguage()==='zh'?({S:ui('Small'),M:ui('Medium'),L:ui('Large'),Full:ui('Full')} as Record<string,string>)[preset.name]||preset.name:preset.name}
    </$ImageButton>
  )
}
