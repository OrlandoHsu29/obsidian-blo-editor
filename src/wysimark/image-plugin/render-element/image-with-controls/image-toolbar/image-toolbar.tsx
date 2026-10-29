import React, { Dispatch, SetStateAction, useEffect, useRef, useState } from "react"
import { createPortal } from 'react-dom'
import { ReactEditor, useSlateStatic } from 'slate-react'

import { $ImageToolbar } from "../../../styles/image-with-controls-styles/image-toolbar-styles"
import {
  ImageBlockElement,
  ImageInlineElement,
  ImageSize,
  ImageSizePreset,
} from "../../../types"
import { ImagePresetButtonGroup } from "./image-preset-buttons/image-preset-button-group"
import { ImageTypeButtonGroup } from "./image-type-buttons/image-type-button-group"
import { useBlockToolbarPosition } from '../../../../use-reposition/hooks/use-block-toolbar-position'

/**
 * The ImageToolbar appears above an image when the image is selected.
 *
 * It includes:
 *
 * - A set of image resize presets when clicked resizes the image to the preset
 * - Buttons to toggle between a block image and an inline image
 */
export function ImageToolbar({
  element,
  size,
  setSize,
  srcSize,
  presets,
  isDragging = false,
}: {
  element: ImageBlockElement | ImageInlineElement
  size: ImageSize
  setSize: Dispatch<SetStateAction<ImageSize | null>>
  srcSize: ImageSize
  presets: ImageSizePreset[]
  isDragging?: boolean
}) {
  const editor = useSlateStatic()
  const ref = useRef<HTMLSpanElement>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setAnchor(ReactEditor.toDOMNode(editor, element).querySelector<HTMLElement>('[data-blo-image]'))
  }, [editor, element])
  const position = useBlockToolbarPosition(anchor, ref, { active: !isDragging })
  if (!anchor) return null
  // Portals escape Slate chunk paint containment without disabling chunking.
  return createPortal(
    <$ImageToolbar ref={ref} className="wysimark-overlay wysimark-block-toolbar wysimark-image-toolbar" data-wysimark-toolbar="image" contentEditable={false}
      style={{ left: position.left, top: position.top, maxWidth: position.maxWidth, visibility: position.visible ? 'visible' : 'hidden', pointerEvents: position.visible ? 'auto' : 'none' }}
      onMouseDown={event => { event.preventDefault(); event.stopPropagation() }}
      onClick={event => event.stopPropagation()}>
      <ImageTypeButtonGroup element={element} />
      <ImagePresetButtonGroup
        element={element}
        size={size}
        setSize={setSize}
        srcSize={srcSize}
        presets={presets}
      />
    </$ImageToolbar>, anchor.ownerDocument.body
  )
}
