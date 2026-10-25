import { Descendant, Element, Node, Text } from 'slate'
import { isEditorSpacer, isListBlock } from './model'
import { mappedTextColors } from './colors'
import { isStructuredBlock } from './structured-block'

export function blockSpacing(node:Node):{before:number;after:number} {
  if(Element.isElement(node)&&node.__subtitle)return {before:1.2,after:.85}
  if(isListBlock(node)&&'blockChildren' in node&&node.blockChildren&&Element.isElement(node.children[0])&&node.children[0].type==='heading')return blockSpacing(node.children[0])
  if(Element.isElement(node)&&node.type==='heading')return [
    {before:1.55,after:.8},{before:1.3,after:.7},{before:1.1,after:.65},
    {before:.95,after:.6},{before:1.2,after:.85},{before:.8,after:.55},
  ][node.level-1]
  if(isListBlock(node))return {before:.35,after:.35}
  if(Element.isElement(node)&&node.type==='block-quote')return {before:.85,after:.85}
  if(Element.isElement(node)&&node.type==='horizontal-rule')return {before:2,after:.65}
  if(isStructuredBlock(node))return {before:1,after:1}
  return {before:.65,after:.65}
}
export function blockGap(nodes:Node[],index:number):string {
  let previous=index-1;while(previous>=0&&isEditorSpacer(nodes[previous]))previous--
  return previous<0?'0px':`${Math.max(blockSpacing(nodes[index]).before,blockSpacing(nodes[previous]).after)}em`
}
/** Imported text may carry color, never font/layout/spacing declarations. */
export function isDefaultTextColor(value:string):boolean {
  return mappedTextColors(value).foreground===undefined
}
export function cleanInlineStyle(style:string|undefined):string|undefined {
  const colors=new Map<string,string>()
  for(const part of style?.split(';')||[]) {
    const colon=part.indexOf(':');if(colon<0)continue
    let property=part.slice(0,colon).trim().toLowerCase()
    if(property==='background')property='background-color'
    const value=part.slice(colon+1).trim().replace(/\s*!important\s*$/i,'')
    if(!['color','background-color'].includes(property))continue
    if(/^(?:#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%/+\-]+\)|var\(--[\w-]+\))$/i.test(value)) {
      const mapped=mappedTextColors(value),color=property==='color'?mapped.foreground:mapped.background
      if(color)colors.set(property,color);else colors.delete(property)
    }
  }
  return colors.size?Array.from(colors,([key,value])=>`${key}:${value}`).join(';'):undefined
}
export function cleanPastedFragment(fragment:Descendant[]):Descendant[] {
  return fragment.map(node=>{
    if(Text.isText(node)) {
      const clone={...node},style=cleanInlineStyle(clone.inlineStyle)
      if(style)clone.inlineStyle=style;else delete clone.inlineStyle
      return clone
    }
    return {...node,children:cleanPastedFragment(node.children)} as Descendant
  })
}
