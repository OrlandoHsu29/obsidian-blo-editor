import { clsx } from "clsx"
import { Dispatch, SetStateAction, useEffect, useRef } from "react"
import { Editor, Transforms } from "slate"
import { ReactEditor, useSlateStatic } from "slate-react"

import { usePointerDrag } from "../../../../utils/use-pointer-drag"
import { withHistoryBatch } from "../../../../utils/with-history-batch"
import { useResizeBrowser } from "../../../../use-reposition/hooks"

import {
  $ImageResizeHandle,
  $ImageResizeInvisibleHandle,
} from "../../../styles/image-with-controls-styles/image-resize-handle-styles"
import {
  ImageBlockElement,
  ImageInlineElement,
  ImageSize,
} from "../../../types"
import { getEditorWidth, minMax, resizeToWidth } from "../../../utils"
import { createResizePreview } from './resize-preview'
import { freezeImageRow } from './resize-image-row'

/**
 * Helper function finds the `img` inside the current Slate `Element`.
 *
 * The `Element` in the DOM points to the surrounding container, so we search
 * inside of it for the `img` tag which know there is only one of.
 *
 * We then get the client rect from it.
 */
function getImageBoundsFromSlateElement(
  editor: Editor,
  element: ImageBlockElement | ImageInlineElement
): DOMRect {
  const imageContainerDOMNode = ReactEditor.toDOMNode(editor, element)
  const imgDOMNode = imageContainerDOMNode.querySelector("[data-blo-drawing],[data-blo-pdf],video,img")
  if (!imgDOMNode)
    throw new Error(`Image Element could not be found but should exist`)
  return imgDOMNode.getBoundingClientRect()
}

export function ImageResizeControl({
  element,
  srcSize,
  size,
  setSize,
  isDragging,
  setIsDragging,
  heightOffset = 0,
}: {
  element: ImageBlockElement | ImageInlineElement
  srcSize: ImageSize
  size: ImageSize
  setSize: Dispatch<SetStateAction<ImageSize | null>>
  isDragging: boolean
  setIsDragging: Dispatch<SetStateAction<boolean>>
  heightOffset?: number
}) {
  const editor = useSlateStatic()
  const resize = useRef<{ startX: number; startWidth: number; scale: number; maxWidth: number; source: ImageSize; heightOffset: number; initial: ImageSize; next: ImageSize } | null>(null)
  const preview = useRef<ReturnType<typeof createResizePreview> | null>(null)
  const row = useRef<ReturnType<typeof freezeImageRow>>(undefined)
  useEffect(() => () => { preview.current?.cancel(); row.current?.clear() }, [])
  useResizeBrowser()
  const width = size.width
  // Reading the editable's width after each preview write forces layout of
  // the note. A gesture uses the bounds measured once at pointerdown.
  const maxWidth = resize.current?.maxWidth ?? Math.min(srcSize.width, getEditorWidth(editor))
  const minWidth = Math.min(12, srcSize.width)
  const finish = (commit: boolean) => {
    const pending = resize.current
    preview.current?.cancel(); preview.current = null
    const group = row.current
    group?.clear(); row.current = undefined
    resize.current = null
    setIsDragging(false)
    if (!pending) return
    if (!commit || pending.next === pending.initial || editor.wysimark.readOnly || editor.wysimark.isCurrentDocument?.() === false) {
      setSize(pending.initial)
      return
    }
    // The last pointer move may still be waiting for its animation frame.
    setSize(pending.next)
    const path = ReactEditor.findPath(editor, element)
    withHistoryBatch(editor, () => {
      group?.commit()
      Transforms.setNodes(editor, { ...pending.next, srcWidth: pending.source.width, srcHeight: pending.source.height }, { at: path })
    })
  }
  const drag = usePointerDrag<HTMLSpanElement>({
    onStart: event => {
      if (editor.wysimark.readOnly) return false
      row.current = freezeImageRow(editor, element)
      const bounds = getImageBoundsFromSlateElement(editor, element)
      const startWidth = row.current ? ReactEditor.toDOMNode(editor, element).offsetWidth : bounds.width
      const initial = row.current ? resizeToWidth(startWidth, srcSize) : size
      const maxWidth = row.current ? Math.max(startWidth, row.current.maxWidth) : Math.min(srcSize.width, getEditorWidth(editor))
      const scale = row.current ? bounds.width / startWidth || 1 : 1
      resize.current = { startX: event.clientX, startWidth, scale, maxWidth, source: srcSize, heightOffset, initial, next: initial }
      preview.current = createResizePreview(event.currentTarget.ownerDocument.defaultView!, next => { row.current?.preview(next.width); setSize(next) })
      setIsDragging(true)
    },
    onMove: event => {
      const pending = resize.current!
      const min = Math.min(12, pending.source.width, pending.maxWidth)
      const value = pending.startWidth + (event.clientX - pending.startX) / pending.scale
      const nextWidth = minMax({ value, min, max: pending.maxWidth })
      const aspect = pending.source.width / pending.source.height
      const width = row.current?.snapWidth(nextWidth, aspect, min, pending.maxWidth) ?? nextWidth
      pending.next = resizeToWidth(width, pending.source)
      pending.next.height += pending.heightOffset
      preview.current?.queue(pending.next)
    },
    onEnd: () => finish(true),
    onCancel: () => finish(false),
  })

  /**
   * Add special classNames to modify appearance of resize controls
   */
  const className = clsx({
    "--center": width < maxWidth && width > minWidth,
    "--left": width >= maxWidth && width > minWidth,
    "--right": width <= minWidth && width < maxWidth,
    "--dragging": isDragging,
    "--small": width <= 64 || size.height <= 64,
  })

  return (
    <>
      {/**
       * The invisible handle is not visible but gives a larger drag handle
       * target for the mouse and touch events
       */}
      <$ImageResizeInvisibleHandle
        data-wysimark-image-resize
        className={className}
        {...drag}
      >
        <$ImageResizeHandle>
          <span className="--bar --bar-left" />
          <span className="--bar --bar-center" />
          <span className="--bar --bar-right" />
        </$ImageResizeHandle>
      </$ImageResizeInvisibleHandle>
    </>
  )
}
