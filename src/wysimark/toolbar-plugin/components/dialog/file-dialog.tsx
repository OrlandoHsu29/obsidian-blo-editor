import { ui } from "../../../utils/translations"
import { useRef, useState, useCallback } from "react"
import { useSlateStatic } from "slate-react"

import { CloseMask } from "../../../shared-overlays"
import { stopEvent } from "../../../sink"
import { useAnchoredPanelPosition } from '../../../use-reposition/hooks/use-block-toolbar-position'

import * as Icon from "../../icons"
import { $DialogButton, $DialogHint } from "../../styles/dialog-shared-styles"
import { $FileDialog } from "../../styles/file-dialog-styles"
import { DraggableHeader } from "./DraggableHeader"

export function FileDialog({
  dest,
  close,
  icon,
  buttonCaption,
  buttonHint,
}: {
  dest: HTMLElement
  close: () => void
  icon: React.ReactNode
  buttonCaption: string
  buttonHint: string
}) {
  const editor = useSlateStatic()
  const ref = useRef<HTMLDivElement>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const handleDrag = useCallback((deltaX: number, deltaY: number) => {
    setDragOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
  }, [])

  const style = useAnchoredPanelPosition(dest, ref, { offsetX: dragOffset.x - 16, offsetY: dragOffset.y })

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files == null || e.target.files.length === 0) return
    stopEvent(e)
    const { files } = e.target
    const upload = editor.upload as { upload: (file: File) => void }
    for (const file of files) {
      upload.upload(file)
    }
    close()
  }

  return (
    <>
      <CloseMask close={close} />
      <$FileDialog ref={ref} style={style}>
        <DraggableHeader onDrag={handleDrag} />
        <div>
          <label>
            <input
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={onChange}
            />
            <$DialogButton>
              {icon}

              <span style={{ marginLeft: "0.5em" }}>{buttonCaption}</span>
            </$DialogButton>
          </label>
          <$DialogHint>{buttonHint}</$DialogHint>
        </div>
      </$FileDialog>
    </>
  )
}

export function AttachmentDialog({
  dest,
  close,
}: {
  dest: HTMLElement
  close: () => void
}) {
  return (
    <FileDialog
      dest={dest}
      close={close}
      icon={<Icon.FileUpload />}
      buttonCaption={ui("Select files...")}
      buttonHint={ui("Select files to insert as attachments")}
    />
  )
}

export function ImageDialog({
  dest,
  close,
}: {
  dest: HTMLElement
  close: () => void
}) {
  return (
    <FileDialog
      dest={dest}
      close={close}
      icon={<Icon.PhotoUp />}
      buttonCaption={ui("Select images...")}
      buttonHint={ui("Select image files to upload and insert into the editor")}
    />
  )
}
