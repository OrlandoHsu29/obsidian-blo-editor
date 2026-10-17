import { clsx } from "clsx"
import { useCallback, useRef, useState } from "react"
import { ReactEditor, useSlate } from "slate-react"
import { Editor, Element } from 'slate'
import { setTableHeader } from '../../../table-plugin/headers'
import { TableElement } from '../../../table-plugin/types'
import { ui } from '../../../utils/translations'

import { CloseMask } from "../../../shared-overlays"
import { useAbsoluteReposition } from "../../../use-reposition"

import {
  $TableDialog,
  $TableDialogGrid,
  $TableDialogGridCell,
} from "../../styles/table-styles"

function createRange(size: number): number[] {
  return [...Array(size).keys()]
}

export function TableDialog({
  dest,
  close,
}: {
  dest: HTMLElement
  close: () => void
}) {
  const [hover, setHover] = useState({ x: 0, y: 0 })
  const editor = useSlate()
  const table=editor.selection?Editor.above<TableElement>(editor,{match:n=>Element.isElement(n)&&n.type==='table'})?.[0]:undefined
  const ref = useRef<HTMLDivElement>(null)
  const style = useAbsoluteReposition({ src: ref, dest }, ({ dest }) => {
    return { left: dest.left - 8, top: dest.top + dest.height }
  })
  const rows = createRange(5).map((i) => i + 1)
  const cols = createRange(5).map((i) => i + 1)

  const hoverCell = useCallback(
    (x: number, y: number) => {
      setHover({ x, y })
    },
    [setHover]
  )

  const createTable = useCallback(
    (x: number, y: number) => {
      editor.tablePlugin.insertTable(x, y)
      ReactEditor.focus(editor)
      close()
    },
    [editor]
  )

  return (
    <>
      <CloseMask close={close} />
      <$TableDialog ref={ref} style={style}>
        {table&&<div className="wysimark-table-settings">
          <label><input type="checkbox" checked={table.headerRow!==false} onChange={event=>setTableHeader(editor,'headerRow',event.target.checked)} />{ui('标题行')}</label>
          <label><input type="checkbox" checked={!!table.headerColumn} onChange={event=>setTableHeader(editor,'headerColumn',event.target.checked)} />{ui('标题列')}</label>
        </div>}
        <$TableDialogGrid onMouseLeave={() => hoverCell(0, 0)}>
          {rows.map((y) => {
            return cols.map((x) => {
              const selected = x <= hover.x && y <= hover.y
              return (
                <$TableDialogGridCell
                  className={clsx({ "--selected": selected })}
                  key={`${x},${y}`}
                  onMouseEnter={() => hoverCell(x, y)}
                  onClick={() => createTable(x, y)}
                />
              )
            })
          })}
        </$TableDialogGrid>
      </$TableDialog>
    </>
  )
}
