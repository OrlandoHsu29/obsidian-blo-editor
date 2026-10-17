import { createContext } from "react"

export const TableContext = createContext<{ isSelected: boolean; headerRow?:boolean; headerColumn?:boolean }>({
  isSelected: false,
})
