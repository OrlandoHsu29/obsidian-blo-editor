import { useCallback, useRef } from "react"
import { useSlateStatic } from "slate-react"

import { ConstrainedRenderElementProps } from "../../sink"

import { TaskListItemElement } from "../types"
import { CheckedIcon, UncheckedIcon } from "./list-icons"
import { $TaskListItem } from "./styles"
import { useFirstLineAlignment } from '../../../blocks/first-line-alignment'

export function TaskListItem({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<TaskListItemElement>) {
  const editor = useSlateStatic()
  const toggle = useCallback(() => {
    editor.list.toggleTaskListItem({ at: element })
  }, [editor, element])

  const ref=useRef<HTMLLIElement>(null)
  const attachList=useCallback((node:HTMLLIElement|null)=>{
    ref.current=node
    attributes.ref(node)
  },[attributes.ref])
  const align=useFirstLineAlignment(ref,'--wysimark-list-marker-center')
  const marginLeft = `${element.depth * 2}em`
  return (
    <$TaskListItem {...attributes} ref={attachList} style={{ marginLeft }} onMouseEnter={align}>
      <div className="--list-item-icon" data-list-marker contentEditable={false}>
        {element.checked ? (
          <CheckedIcon onClick={toggle} style={{ cursor: "pointer" }} />
        ) : (
          <UncheckedIcon onClick={toggle} style={{ cursor: "pointer" }} />
        )}
      </div>
      <div className="wysimark-list-content">{children}</div>
    </$TaskListItem>
  )
}
