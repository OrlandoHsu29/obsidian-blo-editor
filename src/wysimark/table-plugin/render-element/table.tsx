import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { ReactEditor, useReadOnly, useSelected, useSlateSelector, useSlateStatic } from "slate-react"

import { ConstrainedRenderElementProps } from "../../sink"

import { normalizeTableIndexes } from "../normalize/normalize-table"
import { TableElement } from "../types"
import { $Table } from "./styles"
import { TableContext, TableDeletePreview } from "./table-context"
import { useBlockSelection } from '../../../blocks/use-block-selection'
import { getTableAxisSelection, subscribeTableAxisSelection, tableCellSelection } from '../cell-selection'
import { TableInteractions } from './table-interactions'

export function Table({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<TableElement>) {
  const editor = useSlateStatic()
  const isSelected = useSelected()
  const readOnly=useReadOnly()
  const blockSelected=useBlockSelection(element)
  const [deletePreview,setDeletePreview]=useState<TableDeletePreview>(null)
  const axis=useSyncExternalStore(useCallback(listener=>subscribeTableAxisSelection(editor,listener),[editor]),
    useCallback(()=>getTableAxisSelection(editor),[editor]))
  const cells=useSlateSelector(useCallback(editor=>{
    if(blockSelected)return undefined
    const cells=tableCellSelection(editor)
    return cells?.table===element?cells:undefined
  },[element,blockSelected,axis]),(a,b)=>a?.table===b?.table&&a?.left===b?.left&&a?.right===b?.right&&a?.top===b?.top&&a?.bottom===b?.bottom&&a?.axis===b?.axis)
  /**
   * The first time we render a table, we make sure it is normalized.
   * When it comes out of an `initialValue` it's not guaranteed to include
   * `x` and `y` properties as they are optional.
   *
   * This mainly helps us not have to manually add these values when the
   * `x` and `y` are purely an internal requirement for rendering.
   */
  useEffect(() => {
    try {
      const path = ReactEditor.findPath(editor, element)
      normalizeTableIndexes(editor, [element, path])
    } catch {
      // The element path may be stale if other normalizations shifted indices
      // before this effect runs. normalizeNode will handle x/y as needed.
    }
  }, [])
  return (
    <TableContext.Provider value={{ isSelected:isSelected&&!readOnly,blockSelected:blockSelected&&!readOnly,cells,headerRow:element.headerRow!==false,headerColumn:!!element.headerColumn,deletePreview:!readOnly?deletePreview:null,setDeletePreview }}>
      <$Table {...attributes} columns={element.columns} data-block-selected={blockSelected&&!readOnly||undefined} data-axis-selection={cells?.axis} data-cell-selection={cells&&!readOnly?true:undefined}>
        <tbody>{children}</tbody>
      </$Table>
      <TableInteractions element={element} readOnly={readOnly} active={isSelected||blockSelected} />
    </TableContext.Provider>
  )
}
