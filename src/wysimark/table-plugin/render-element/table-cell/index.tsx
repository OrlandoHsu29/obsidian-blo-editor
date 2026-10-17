import { useContext } from "react"
import { useSelected } from "slate-react"

import { ConstrainedRenderElementProps } from "../../../sink"

import { TableCellElement } from "../../types"
import { $TableCell } from "../styles"
import { TableContext } from "../table-context"
import { ColumnMenu } from "./column-menu"
import { RowMenu } from "./row-menu"

export function TableCell({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<TableCellElement>) {
  const tableContext = useContext(TableContext)
  const selected = useSelected()
  /**
   * table has slection and we are in the top left cell
   */
  /**
   * table has selection and we are in the left columns
   */
  const showRowMenu = tableContext.isSelected && element.x === 0
  /**
   * table has selection and we are in the top row
   */
  const showColumnMenu = tableContext.isSelected && element.y === 0
  return (
    <$TableCell
      className={selected ? "--selected" : ""}
      {...attributes}
      data-x={element.x}
      data-y={element.y}
      data-table-header={(tableContext.headerRow&&element.y===0)||(tableContext.headerColumn&&element.x===0)||undefined}
    >
      {children}
      {showRowMenu ? <RowMenu cellElement={element} /> : null}
      {showColumnMenu ? <ColumnMenu cellElement={element} /> : null}
    </$TableCell>
  )
}
