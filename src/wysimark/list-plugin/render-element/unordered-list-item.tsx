import { ConstrainedRenderElementProps } from "../../sink"

import { UnorderedListItemElement } from "../types"
import { BulletIcon } from "./list-icons"
import { $UnorderedListItem } from "./styles"
import { useRef } from 'react'
import { useFirstLineAlignment } from '../../../blocks/first-line-alignment'

export function UnorderedListItem({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<UnorderedListItemElement>) {
  const marginLeft = `${2 + element.depth * 2}em`
  const ref=useRef<HTMLLIElement>(null)
  const align=useFirstLineAlignment(ref,'--wysimark-list-marker-center')
  return (
    <$UnorderedListItem {...attributes} ref={ref} style={{ marginLeft }} onMouseEnter={align}>
      <div className="--list-item-icon" contentEditable={false}>
        <BulletIcon />
      </div>
      {children}
    </$UnorderedListItem>
  )
}
