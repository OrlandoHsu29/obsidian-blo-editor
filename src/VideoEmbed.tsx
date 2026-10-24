import { App, TFile } from 'obsidian'
import { useEffect, useState } from 'react'
import { Transforms } from 'slate'
import { ReactEditor, useElement, useReadOnly, useSelected, useSlateStatic } from 'slate-react'
import { selectBlockContents } from './blocks/selection'
import type { ImageBlockElement, ImageInlineElement, ImageSize } from './wysimark/image-plugin/types'
import { ImageResizeControl } from './wysimark/image-plugin/render-element/image-with-controls/image-resize-controls/image-resize-control'
import { ImageToolbar } from './wysimark/image-plugin/render-element/image-with-controls/image-toolbar/image-toolbar'
import { ImageSizeStatus } from './wysimark/image-plugin/render-element/image-with-controls/image-size-status/image-size-status'

export const VIDEO_FILE_PATTERN = /\.(?:mp4|webm|ogv|mov|mkv|3gp)$/i

/** The same Slate image node persists video dimensions and atomic selection. */
export function VideoEmbed({ app, file }: { app: App; file: TFile }) {
  const editor = useSlateStatic()
  const element = useElement() as ImageBlockElement | ImageInlineElement
  const selected = useSelected(), readOnly = useReadOnly()
  const [naturalSize, setNaturalSize] = useState<ImageSize | null>(null)
  const [size, setSize] = useState<ImageSize | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  useEffect(() => {
    setSize(element.width && element.height ? { width: element.width, height: element.height } : null)
  }, [element.width, element.height])
  const width = size?.width ?? element.width ?? (naturalSize ? Math.min(640, naturalSize.width) : 640)
  const displaySize = naturalSize ? { width, height: width * naturalSize.height / naturalSize.width } : null
  return <span className={`blo-video${selected && !readOnly ? ' is-selected' : ''}`} data-blo-image data-blo-video
    contentEditable={false} style={{ width }}
    onMouseDown={event => {
      if (readOnly || event.button !== 0 || (event.target as HTMLElement).closest('[data-wysimark-image-resize],button')) return
      event.stopPropagation()
      const path = ReactEditor.findPath(editor, element)
      if (path.length === 1) selectBlockContents(editor, path[0])
      else Transforms.select(editor, path)
      // Keep the native video controls' default pointer action (play, seek, volume).
    }}>
    <video controls preload="metadata" src={app.vault.getResourcePath(file)}
      onLoadedMetadata={event => {
        const video = event.currentTarget
        if (video.videoWidth && video.videoHeight) setNaturalSize({ width: video.videoWidth, height: video.videoHeight })
      }} />
    {!readOnly && selected && displaySize && naturalSize && <>
      <ImageToolbar element={element} size={displaySize} setSize={setSize} srcSize={naturalSize}
        presets={element.type === 'image-block' ? editor.image.imageBlockPresets : editor.image.imageInlinePresets} />
      <ImageResizeControl element={element} size={displaySize} setSize={setSize} srcSize={naturalSize}
        isDragging={isDragging} setIsDragging={setIsDragging} />
    </>}
    {isDragging && size && <ImageSizeStatus size={size} />}
  </span>
}
