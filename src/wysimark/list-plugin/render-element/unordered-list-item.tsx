import { ConstrainedRenderElementProps } from "../../sink"

import { UnorderedListItemElement } from "../types"
import { BulletIcon } from "./list-icons"
import { $UnorderedListItem } from "./styles"
import { useCallback, useRef } from 'react'
import { useFirstLineAlignment } from '../../../blocks/first-line-alignment'

export function UnorderedListItem({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<UnorderedListItemElement>) {
  const marginLeft = `${2 + element.depth * 2}em`
  const ref=useRef<HTMLLIElement>(null)
  const attachList=useCallback((node:HTMLLIElement|null)=>{
    ref.current=node
    attributes.ref(node)
  },[attributes.ref])
  const align=useFirstLineAlignment(ref,'--wysimark-list-marker-center')
  return (
    <$UnorderedListItem {...attributes} ref={attachList} style={{ marginLeft }} onMouseEnter={align}>
      <div className="--list-item-icon" contentEditable={false}>
        <BulletIcon />
      </div>
      {children}
    </$UnorderedListItem>
  )
}
