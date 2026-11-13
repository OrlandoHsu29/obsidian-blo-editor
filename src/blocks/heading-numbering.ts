import { Editor, Element, Node, Range, Transforms } from 'slate'
import type { Location, Path } from 'slate'
import { withHistoryBatch } from '../wysimark/utils/with-history-batch'
import { blockDepth, canIndentBlock, rootCache } from './model'
import { selectionHasMainHeading } from './heading-policy'
import { setListBlock } from './list-container'
import { unwrapHeadingList } from './heading-conversion'

const isNumberedHeading = (node: Node) => Element.isElement(node) && node.type === 'heading' && node.level >= 1 && node.level <= 4 && !node.__subtitle
export type HeadingListStyle = 'hash' | 'number'
export type HeadingListLevel = 1 | 2 | 3 | 4
type HeadingListState = { count: number; style: HeadingListStyle; levels: readonly HeadingListLevel[]; uniform: boolean }
const listStates = new WeakMap<ReturnType<typeof rootCache>['headings'], HeadingListState>()

export function toggleHeadingListLevel(editor: Editor, level: HeadingListLevel): void {
  const { style, levels } = headingListState(editor)
  const enabled = !levels.includes(level)
  changeHeadings(editor, heading => heading.type === 'heading' && heading.level === level
    ? { style, enabled }
    : undefined)
}

export function headingListState(editor: Editor): HeadingListState {
  const headings = rootCache(editor).headings
  let state = listStates.get(headings)
  if (!state) {
    let count = 0, numbered = false, savedStyle: HeadingListStyle | undefined
    const counts = new Map<HeadingListLevel,{total:number;hash:number;number:number}>()
    for (const heading of headings) {
      const node = heading.node
      if (!isNumberedHeading(node) || node.type !== 'heading') continue
      count++
      savedStyle ??= node.__headingList?.style
      numbered ||= heading.numberLabel !== undefined
      const level = node.level as HeadingListLevel
      const current = counts.get(level) ?? {total:0,hash:0,number:0}
      current.total++
      if(heading.numberLabel !== undefined)current.number++
      else if(node.__headingList?.enabled !== false)current.hash++
      counts.set(level,current)
    }
    const style = savedStyle ?? (numbered ? 'number' : 'hash')
    state = { count, style, levels: [...counts].filter(([,n])=>n[style]===n.total).map(([level])=>level).sort(),
      uniform: [...counts.values()].every(n=>n[style==='number'?'hash':'number']===0) }
    listStates.set(headings, state)
  }
  return state
}

export function setHeadingListStyle(editor: Editor, style: HeadingListStyle): void {
  const state=headingListState(editor)
  if (state.style === style && state.uniform) return
  changeHeadings(editor, heading => {
    const enabled = heading.__headingList?.enabled !== false
    return { style, enabled }
  })
}

/** Use the state from before conversion, before a new heading affects level totals. */
export function inheritHeadingList(editor:Editor,at:Location,state:HeadingListState,preserveOrderedLists=false):void {
  const entries=[...Editor.nodes(editor,{at,match:isNumberedHeading})]
  for(const [heading,path] of entries.reverse()) {
    if(preserveOrderedLists&&Editor.above(editor,{at:path,match:n=>Element.isElement(n)&&n.type==='ordered-list-item'}))continue
    if(!state.count){unwrapHeadingList(editor,path);continue}
    if(Element.isElement(heading)&&heading.type==='heading')setHeadingList(editor,path,{
      style:state.style,enabled:state.levels.includes(heading.level as HeadingListLevel),
    })
  }
}

function currentHeadingStyle(editor:Editor,heading:Element,path:Path):HeadingListStyle|undefined {
  const parent=path.length>1?Node.get(editor,path.slice(0,-1)):undefined
  if(Element.isElement(parent)&&parent.type==='ordered-list-item'&&parent.blockChildren&&path[path.length-1]===0)return 'number'
  return heading.__headingList?.enabled===false?undefined:'hash'
}

/** Toolbar and keyboard shortcuts share the document's selected heading-list type. */
export function headingListControlDisabled(editor:Editor,style:HeadingListStyle):boolean {
  if(!selectionHasMainHeading(editor))return false
  return headingListState(editor).style!==style || !Editor.nodes(editor,{match:isNumberedHeading}).next().value
}

export function headingListSelectionActive(editor:Editor,style:HeadingListStyle):boolean {
  if(!editor.selection)return false
  const entries=[...Editor.nodes(editor,{match:isNumberedHeading})]
  return entries.length>0&&entries.every(([node,path])=>Element.isElement(node)&&currentHeadingStyle(editor,node,path)===style)
}

/** Only selections containing main headings take this path; prose uses the existing commands. */
export function convertSelectedHeadingList(editor:Editor,style:HeadingListStyle,toggle:boolean):boolean {
  if(!editor.selection||editor.wysimark.readOnly)return false
  const selected=new Set([...Editor.nodes(editor,{match:isNumberedHeading})].map(([node])=>node))
  if(!selected.size)return false
  if(headingListControlDisabled(editor,style))return true
  const type=style==='number'?'ordered-list-item':'unordered-list-item'
  const entries=[...Editor.nodes(editor,{mode:'highest',match:n=>Element.isElement(n)&&(isNumberedHeading(n)||
    ('blockChildren' in n&&n.blockChildren&&n.type.endsWith('list-item'))||editor.convertElement.isConvertibleElement(n))})]
    .filter(([node])=>!Element.isElement(node)||!('blockChildren' in node&&node.blockChildren&&isNumberedHeading(node.children[0]))||selected.has(node.children[0]))
  const headingAt=(node:Element,path:Path):[Element,Path]|undefined=>isNumberedHeading(node)?[node,path]:
    ('blockChildren' in node&&node.blockChildren&&isNumberedHeading(node.children[0]))?[node.children[0] as Element,[...path,0]]:undefined
  const remove=toggle&&entries.every(([node,path])=>{
    if(!Element.isElement(node))return false
    const heading=headingAt(node,path)
    return heading?currentHeadingStyle(editor,...heading)===style:node.type===type
  })
  withHistoryBatch(editor,()=>{
    for(const [node,path] of entries.reverse()) {
      if(!Element.isElement(node))continue
      const heading=headingAt(node,path)
      if(heading)setHeadingList(editor,heading[1],{style,enabled:!remove})
      else setListBlock(editor,node,path,remove?undefined:type)
    }
  })
  return true
}

export function deleteHeadingListPrefix(editor:Editor):boolean {
  if(editor.wysimark.readOnly||!editor.selection||!Range.isCollapsed(editor.selection))return false
  const entry=Editor.above(editor,{match:isNumberedHeading})
  if(!entry||!Element.isElement(entry[0])||!Editor.isStart(editor,editor.selection.anchor,entry[1]))return false
  const style=currentHeadingStyle(editor,entry[0],entry[1])
  if(!style)return false
  withHistoryBatch(editor,()=>setHeadingList(editor,entry[1],{style:entry[0].__headingList?.style??style,enabled:false}))
  return true
}

function changeHeadings(editor: Editor, change: (heading: Element) => NonNullable<Element['__headingList']> | undefined): void {
  if (editor.wysimark.readOnly) return
  const entries = [...Editor.nodes(editor, { at: [], match: isNumberedHeading })]
  withHistoryBatch(editor, () => {
    // Work backwards so wrapping/unwrapping cannot invalidate subsequent paths.
    for (const [heading, path] of entries.reverse()) {
      if (!Element.isElement(heading)) continue
      const update = change(heading)
      if (!update) continue
      setHeadingList(editor,path,update)
    }
  })
}

function setHeadingList(editor:Editor,path:Path,settings:NonNullable<Element['__headingList']>):void {
  const numbered=settings.style==='number'&&settings.enabled
  const parentPath=path.slice(0,-1)
  const parent=parentPath.length?Node.get(editor,parentPath):undefined
  const owner=Element.isElement(parent)&&parent.type==='ordered-list-item'&&parent.blockChildren&&path[path.length-1]===0?parent:undefined
  Transforms.setNodes(editor,{__headingList:settings,__blockDepth:0},{at:path})
  if(numbered) {
    if(owner) {
      Transforms.unsetNodes(editor,['start','__firstAtDepth'],{at:parentPath})
      Transforms.setNodes(editor,{__numbering:'continue',depth:0,__blockDepth:0},{at:parentPath})
    } else {
      Transforms.wrapNodes(editor,{
        type:'ordered-list-item',blockChildren:true,depth:0,__numbering:'continue',children:[],
      },{at:path})
    }
  } else if(owner) {
    owner.children.forEach((child,index)=>{
      if(Element.isElement(child)&&canIndentBlock(child)&&blockDepth(child)<blockDepth(owner)) {
        Transforms.setNodes(editor,{__blockDepth:blockDepth(owner)},{at:[...parentPath,index]})
      }
    })
    Transforms.unwrapNodes(editor,{at:parentPath})
  }
}
