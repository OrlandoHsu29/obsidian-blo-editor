import React, { Dispatch, SetStateAction, useEffect, useLayoutEffect, useRef, useState } from "react"
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
  const [position, setPosition] = useState({ left: 0, top: 0, maxWidth: 0, visible: false })
  useEffect(() => {
    setAnchor(ReactEditor.toDOMNode(editor, element).querySelector<HTMLElement>('[data-blo-image]'))
  }, [editor, element])
  useLayoutEffect(() => {
    const panel = ref.current, win = anchor?.ownerDocument.defaultView
    if (!anchor || !panel || !win) return
    const scroller = anchor.closest<HTMLElement>('.wysimark-editor-container')
    const mainToolbar = anchor.closest('.wysimark-container')?.querySelector<HTMLElement>('[data-wysimark-toolbar]')
    let frame = 0
    const place = () => {
      const bounds = anchor.getBoundingClientRect(), clip = scroller?.getBoundingClientRect()
      const leftEdge = Math.max(0, clip?.left ?? 0) + 8
      const rightEdge = Math.min(win.innerWidth, clip?.right ?? win.innerWidth) - 8
      const topEdge = Math.max(0, clip?.top ?? 0, mainToolbar?.getBoundingClientRect().bottom ?? 0) + 8
      const bottomEdge = Math.min(win.innerHeight, clip?.bottom ?? win.innerHeight) - 8
      const box = panel.getBoundingClientRect()
      const next = {
        left: Math.max(leftEdge, Math.min(bounds.left, rightEdge - box.width)),
        top: Math.max(topEdge, Math.min(bounds.top - box.height - 8, bottomEdge - box.height)),
        maxWidth: Math.max(0, rightEdge - leftEdge),
        visible: bounds.bottom > topEdge && bounds.top < bottomEdge && bounds.right > leftEdge && bounds.left < rightEdge,
      }
      setPosition(old => old.left === next.left && old.top === next.top && old.maxWidth === next.maxWidth && old.visible === next.visible ? old : next)
    }
    const schedule = () => { win.cancelAnimationFrame(frame); frame = win.requestAnimationFrame(place) }
    place()
    const observer = new ResizeObserver(schedule)
    for (const target of [anchor, panel, scroller, mainToolbar]) if (target) observer.observe(target)
    win.addEventListener('scroll', schedule, true)
    win.addEventListener('resize', schedule)
    return () => {
      observer.disconnect(); win.cancelAnimationFrame(frame)
      win.removeEventListener('scroll', schedule, true); win.removeEventListener('resize', schedule)
    }
  }, [anchor])
  if (!anchor) return null
  // Portals escape Slate chunk paint containment without disabling chunking.
  return createPortal(
    <$ImageToolbar ref={ref} className="wysimark-overlay wysimark-image-toolbar" data-wysimark-toolbar="image" contentEditable={false}
      style={{ left: position.left, top: position.top, maxWidth: position.maxWidth, visibility: position.visible && !isDragging ? 'visible' : 'hidden' }}
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
