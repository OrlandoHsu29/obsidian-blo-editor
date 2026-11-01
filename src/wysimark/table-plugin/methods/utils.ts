import { TableCellElement, TableContentElement } from "../types"

export function createCell(
  children: TableContentElement[] = [
    {
      type: "table-content",
      children: [{ text: "" }],
    },
  ]
): TableCellElement {
  return {
    type: "table-cell",
    children,
  }
}
