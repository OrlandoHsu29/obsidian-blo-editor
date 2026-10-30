import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { Path, Range } from "slate"
import { ReactEditor, useReadOnly, useSelected, useSlateSelector, useSlateStatic } from "slate-react"

import { ConstrainedRenderElementProps } from "../../sink"

import { normalizeTableIndexes } from "../normalize/normalize-table"
import { TableElement } from "../types"
import { $Table } from "./styles"
import { TableContext, TableDeletePreview } from "./table-context"
import { useBlockSelection } from '../../../blocks/use-block-selection'
import { getTableAxisSelection, subscribeTableAxisSelection, tableCellSelection } from '../cell-selection'
import { TableInteractions } from './table-interactions'
import { useTableOverflow } from './use-table-overflow'

export function Table({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<TableElement>) {
  const editor = useSlateStatic()
  const frame = useTableOverflow(element)
  const isSelected = useSelected()
  const readOnly=useReadOnly()
  const blockSelected=useBlockSelection(element)
  // Cross-block text ranges use the same cell backgrounds as table selections.
  // Keep the original range intact for clipboard and deletion operations.
  const crossBlockSelection=useSlateSelector(useCallback(editor=>{
    const selection=editor.selection
    if(!selection||Range.isCollapsed(selection))return false
    const path=ReactEditor.findPath(editor,element)
    return !Path.isAncestor(path,selection.anchor.path)||!Path.isAncestor(path,selection.focus.path)
  },[editor,element]))
  const [deletePreview,setDeletePreview]=useState<TableDeletePreview>(null)
  const axis=useSyncExternalStore(useCallback(listener=>subscribeTableAxisSelection(editor,listener),[editor]),
    useCallback(()=>getTableAxisSelection(editor),[editor]))
  const cells=useSlateSelector(useCallback(editor=>{
    if(blockSelected)return undefined
    const cells=tableCellSelection(editor)
    return cells?.table===element?cells:undefined
  },[element,blockSelected,axis]),(a,b)=>a?.table===b?.table&&a?.left===b?.left&&a?.right===b?.right&&a?.top===b?.top&&a?.bottom===b?.bottom&&a?.axis===b?.axis&&a?.kind===b?.kind)
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
      <div ref={frame} className="blo-table-frame" data-scrollbar-active={isSelected||blockSelected||!!cells||undefined}>
        <div className="blo-table-scroll">
          <$Table {...attributes} columns={element.columns} data-block-selected={blockSelected&&!readOnly||undefined} data-cell-selection={!readOnly&&(cells||isSelected&&crossBlockSelection)?true:undefined}>
            <tbody>{children}</tbody>
          </$Table>
        </div>
      </div>
      <TableInteractions element={element} readOnly={readOnly} active={isSelected||blockSelected} />
    </TableContext.Provider>
  )
}
