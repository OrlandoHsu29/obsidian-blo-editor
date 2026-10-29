import { clsx } from "clsx"
import { useCallback, useRef, useState } from "react"
import { ReactEditor, useSlate } from "slate-react"
import { ui } from '../../../utils/translations'

import { CloseMask } from "../../../shared-overlays"
import { useAnchoredPanelPosition } from '../../../use-reposition/hooks/use-block-toolbar-position'

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
  const [defaults,setDefaults]=useState(()=>editor.wysimark.getTableDefaults?.()??{headerRow:true,headerColumn:false})
  const changeDefault=(key:'headerRow'|'headerColumn',checked:boolean)=>{
    const next={...defaults,[key]:checked}
    setDefaults(next)
    editor.wysimark.setTableDefaults?.(next)
  }
  const ref = useRef<HTMLDivElement>(null)
  const style = useAnchoredPanelPosition(dest, ref, { close, offsetX: -8 })
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
        <div className="wysimark-table-settings">
          <label><input type="checkbox" checked={defaults.headerRow} onChange={event=>changeDefault('headerRow',event.target.checked)} />{ui('默认标题行')}</label>
          <label><input type="checkbox" checked={defaults.headerColumn} onChange={event=>changeDefault('headerColumn',event.target.checked)} />{ui('默认标题列')}</label>
        </div>
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
