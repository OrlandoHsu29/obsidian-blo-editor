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
  const resize = useRef<{ startX: number; startWidth: number; maxWidth: number; source: ImageSize; heightOffset: number; initial: ImageSize; next: ImageSize } | null>(null)
  const preview = useRef<ReturnType<typeof createResizePreview> | null>(null)
  useEffect(() => () => preview.current?.cancel(), [])
  useResizeBrowser()
  const width = size.width
  // Reading the editable's width after each preview write forces layout of
  // the note. A gesture uses the bounds measured once at pointerdown.
  const maxWidth = resize.current?.maxWidth ?? Math.min(srcSize.width, getEditorWidth(editor))
  const minWidth = Math.min(12, srcSize.width)
  const finish = (commit: boolean) => {
    const pending = resize.current
    preview.current?.cancel(); preview.current = null
    resize.current = null
    setIsDragging(false)
    if (!pending) return
    if (!commit || editor.wysimark.readOnly || editor.wysimark.isCurrentDocument?.() === false) {
      setSize(pending.initial)
      return
    }
    // The last pointer move may still be waiting for its animation frame.
    setSize(pending.next)
    const path = ReactEditor.findPath(editor, element)
    withHistoryBatch(editor, () => Transforms.setNodes(editor,
      { ...pending.next, srcWidth: pending.source.width, srcHeight: pending.source.height }, { at: path }))
  }
  const drag = usePointerDrag<HTMLSpanElement>({
    onStart: event => {
      if (editor.wysimark.readOnly) return false
      resize.current = { startX: event.clientX, startWidth: getImageBoundsFromSlateElement(editor, element).width,
        maxWidth: Math.min(srcSize.width, getEditorWidth(editor)), source: srcSize, heightOffset, initial: size, next: size }
      preview.current = createResizePreview(event.currentTarget.ownerDocument.defaultView!, setSize)
      setIsDragging(true)
    },
    onMove: event => {
      const pending = resize.current!
      const nextWidth = minMax({ value: pending.startWidth + event.clientX - pending.startX, min: Math.min(12, pending.source.width), max: pending.maxWidth })
      pending.next = resizeToWidth(nextWidth, pending.source)
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
