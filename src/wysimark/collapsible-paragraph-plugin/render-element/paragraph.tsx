import { clsx } from "clsx"
import { Editor, Transforms } from "slate"
import { HistoryEditor } from "slate-history"
import { ReactEditor, useReadOnly, useSelected, useSlateStatic } from "slate-react"

import { ConstrainedRenderElementProps } from "../../sink"

import { ParagraphElement } from ".."
import { $Paragraph } from "./styles"
import { getIsEmpty } from "./utils"

export function Paragraph({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<ParagraphElement>) {
  const editor = useSlateStatic()
  const readOnly = useReadOnly()
  const selected = useSelected()
  const isEmpty = getIsEmpty(element)
  return (
    <$Paragraph
      {...attributes}
      data-subtitle={element.__subtitle||undefined}
      onMouseDown={event => {
        if (readOnly || event.button !== 0 || !isEmpty || !element.__collapsible) return
        const path = ReactEditor.findPath(editor, element)
        if (path.length !== 1 || path[0] !== editor.children.length - 1) return
        // Clicking the trailing insertion line creates a real paragraph now,
        // so its block spacing cannot jump when the first character is typed.
        event.preventDefault()
        const materialize = () => Editor.withoutNormalizing(editor, () => {
          Transforms.unsetNodes(editor, '__collapsible', { at: path })
          Transforms.select(editor, Editor.start(editor, path))
        })
        if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, materialize)
        else materialize()
        ReactEditor.focus(editor)
      }}
      className={clsx({
        "--selected": selected,
        "--empty": isEmpty,
        "--collapsible": !!element.__collapsible,
      })}
    >
      {children}
    </$Paragraph>
  )
}
