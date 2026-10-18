import { createContext } from "react"
import type { TableCellSelection } from '../cell-selection'

export type TableDeletePreview = { axis: 'row' | 'column'; index: number } | null
export const TableContext = createContext<{ isSelected: boolean; blockSelected?:boolean; cells?:TableCellSelection; headerRow?:boolean; headerColumn?:boolean;
  deletePreview?:TableDeletePreview; setDeletePreview?:(preview:TableDeletePreview)=>void }>({
  isSelected: false,
})
