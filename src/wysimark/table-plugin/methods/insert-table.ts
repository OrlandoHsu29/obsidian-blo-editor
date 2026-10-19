import { Editor, Location } from "slate"

import { insertRootElement } from "../../sink"
export { insertRootElement } from "../../sink"

import { TableColumn, TableElement, TableRowElement } from "../types"
import { createCell } from "./utils"

function createRange(size: number): number[] {
  return [...Array(size).keys()]
}

function createColumns(columnCount: number): TableColumn[] {
  return createRange(columnCount).map(() => ({ align: "left" }))
}

function createTable(columnCount: number, rowCount: number): TableElement {
  return {
    type: "table",
    columns: createColumns(columnCount),
    children: createRange(rowCount).map(y => createRow(columnCount, y)),
  }
}

function createRow(columnCount: number, y: number): TableRowElement {
  return {
    type: "table-row",
    children: [...Array(columnCount).keys()].map(x => ({ ...createCell(x), x, y })),
  }
}

/**
 * Used internally for `insertRowAbove` and `insertRowBelow` to do an insert
 * with an offset to improve code reused.
 */
export function insertTable(
  editor: Editor,
  columnCount: number,
  rowCount: number,
  { at = editor.selection }: { at?: Location | null } = {}
): boolean {
  const table = { ...createTable(columnCount, rowCount),
    ...(editor.wysimark.getTableDefaults?.() ?? { headerRow: true, headerColumn: false }) }
  return insertRootElement(editor, table, { at })
}
