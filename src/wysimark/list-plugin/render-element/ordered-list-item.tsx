import { ui } from "../../utils/translations"
import { clsx } from "clsx"
import { useEffect, useRef } from "react"
import { useFirstLineAlignment } from '../../../blocks/first-line-alignment'
import { ReactEditor, useReadOnly, useSlate } from "slate-react"
import { Menu } from 'obsidian'
import { orderedNumbers, rootCache, setNumbering } from '../../../blocks/model'
import { Element, Node } from 'slate'

import { ConstrainedRenderElementProps } from "../../sink"

import { normalizeOrderedFirstAtDepth } from "../normalize-node"
import { OrderedListItemElement as OrderedListItemElement } from "../types"
import { $OrderedListItem } from "./styles"

export function OrderedListItem({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<OrderedListItemElement>) {
  const editor = useSlate()
  const ref=useRef<HTMLLIElement>(null)
  const align=useFirstLineAlignment(ref,'--wysimark-list-marker-center')
  const first=element.children[0]
  const heading=element.blockChildren&&Element.isElement(first)&&first.type==='heading'?first:undefined
  const readOnly=useReadOnly(),cache=rootCache(editor),index=cache.indices.get(element)
  let number=cache.numbers.get(element) ?? element.start ?? 1
  if(index===undefined) {
    const path=ReactEditor.findPath(editor,element),parent=Node.parent(editor,path)
    number=orderedNumbers(parent.children).get(element) ?? number
  }
  useEffect(() => {
    const path = ReactEditor.findPath(editor, element)
    normalizeOrderedFirstAtDepth(editor, [element, path])
  }, [])
  const style = {
    marginLeft: `${2 + element.depth * 2}em`,
    "--list-item-var": `list-item-depth-${element.depth}`,
    counterReset: element.start != null ? `list-item-depth-${element.depth} ${element.start - 1}` : undefined,
  } as React.CSSProperties
  const className = clsx({ "--first-at-depth": element.__firstAtDepth })
  return (
    <$OrderedListItem {...attributes} ref={ref} data-list-heading-level={heading?.level} className={className} style={style} onMouseEnter={align}>
      <button className="wysimark-list-number" contentEditable={false} disabled={readOnly||index===undefined} data-list-number={number} aria-label={ui('序号 {number}，设置编号',{number})} onMouseDown={event=>event.preventDefault()} onClick={event=>{
        if(index===undefined)return
        event.preventDefault();event.stopPropagation();const menu=new Menu()
        menu.addItem(item=>item.setTitle(ui("继续编号")).setIcon('list-ordered').onClick(()=>setNumbering(editor,index,'continue')))
        menu.addItem(item=>item.setTitle(ui("重新编号（从 1 开始）")).setIcon('rotate-ccw').onClick(()=>setNumbering(editor,index,'restart')))
        menu.showAtMouseEvent(event.nativeEvent)
      }}>{number}.</button>
      {children}
    </$OrderedListItem>
  )
}
