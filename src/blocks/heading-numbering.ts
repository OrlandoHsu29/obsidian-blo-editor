import { Editor, Element, Node, Range, Transforms } from 'slate'
import type { Location, Path } from 'slate'
import { withHistoryBatch } from '../wysimark/utils/with-history-batch'
import { headingPathsForLevel, rootCache } from './model'
import { isHeading, isMainHeadingOrOwner } from './heading-policy'
import { setListBlock } from './list-container'
import { unwrapHeadingList } from './heading-conversion'
import { defaultHeadingListStyles, hasHeadingHashPrefix, headingDefaults, headingLevels, mapHeadingLevels } from './heading-defaults'
import type { HeadingDefaults, HeadingListLevel, HeadingListStyle } from './heading-defaults'

const isNumberedHeading = (node: Node): node is Extract<Element, { type: 'heading' }> =>
  isHeading(node) && node.level >= 1 && node.level <= 4 && !node.__subtitle
type HeadingListState = {
  count: number
  byLevel: HeadingDefaults
  activeLevels: Record<HeadingListStyle, HeadingListLevel[]>
  defaults?: HeadingDefaults
}
const listStates = new WeakMap<ReturnType<typeof rootCache>['headings'], HeadingListState>()

export function toggleHeadingListLevel(editor: Editor, level: HeadingListLevel, style: HeadingListStyle): void {
  if (editor.wysimark.readOnly) return
  const { byLevel, defaults } = headingListState(editor)
  const enabled = byLevel[level] !== style
  const paths = headingPathsForLevel(editor, level)
  withHistoryBatch(editor, () => {
    saveDefaults(editor, { ...(defaults ?? byLevel), [level]: enabled ? style : null })
    // Work backwards so wrapping or unwrapping does not shift subsequent paths.
    const settings = { style, enabled }
    for (const path of paths.reverse()) setHeadingList(editor, path, settings)
  })
}

export function headingListState(editor: Editor): HeadingListState {
  const headings = rootCache(editor).headings
  const defaults = headingDefaults(editor.children[0])
  let state = listStates.get(headings)
  if (!state || state.defaults !== defaults) {
    let count = 0, numbered = false, savedStyle: HeadingListStyle | undefined, savedLevels: readonly HeadingListLevel[] | undefined
    const counts = new Map<HeadingListLevel,{total:number;hash:number;number:number}>()
    for (const heading of headings) {
      const node = heading.node
      if (!isNumberedHeading(node)) continue
      count++
      savedStyle ??= node.__headingList?.style
      savedLevels ??= node.__headingList?.levels
      numbered ||= heading.numberLabel !== undefined
      const level = node.level as HeadingListLevel
      const current = counts.get(level) ?? {total:0,hash:0,number:0}
      current.total++
      if(heading.numberLabel !== undefined)current.number++
      else if (hasHeadingHashPrefix(node, defaults)) current.hash++
      counts.set(level,current)
    }
    const fallbackStyle = savedStyle ?? (numbered ? 'number' : 'hash')
    const byLevel = mapHeadingLevels(level => {
      const current = counts.get(level)
      if (!current) {
        if (defaults) return defaults[level]
        const enabled = savedLevels ? savedLevels.includes(level) : defaultHeadingListStyles[level] !== null
        return enabled ? fallbackStyle : null
      }
      if (current.hash === current.total) return 'hash'
      if (current.number === current.total) return 'number'
      return null
    })
    const active = (style: HeadingListStyle) => headingLevels.filter(level => {
      const current = counts.get(level)
      return current ? current[style] > 0 : byLevel[level] === style
    })
    state = { count, defaults, byLevel, activeLevels: { hash: active('hash'), number: active('number') } }
    listStates.set(headings, state)
  }
  return state
}

/** Use the state from before conversion, before a new heading affects level totals. */
export function inheritHeadingList(editor:Editor,at:Location,state:HeadingListState,preserveOrderedLists=false):void {
  // Consolidate inferred/legacy choices into the same document preset used by
  // the menu, rather than repeating level snapshots on every new heading.
  if(!state.defaults&&state.count)saveDefaults(editor,state.byLevel)
  const entries=[...Editor.nodes(editor,{at,match:isNumberedHeading})]
  for(const [heading,path] of entries.reverse()) {
    if (!Element.isElement(heading) || heading.type !== 'heading') continue
    const style = state.byLevel[heading.level as HeadingListLevel]
    const owner=Editor.above(editor,{at:path,match:n=>Element.isElement(n)&&n.type==='ordered-list-item'})
    if(owner&&(preserveOrderedLists||style==='number'))continue
    if(!state.count&&!state.defaults){unwrapHeadingList(editor,path);continue}
    setHeadingList(editor,path,{style:style ?? 'hash',enabled:style !== null})
  }
}

function currentHeadingStyle(editor:Editor,heading:Element,path:Path):HeadingListStyle|undefined {
  const parent=path.length>1?Node.get(editor,path.slice(0,-1)):undefined
  if(Element.isElement(parent)&&parent.type==='ordered-list-item'&&parent.blockChildren&&path[path.length-1]===0)return 'number'
  return heading.type === 'heading' && hasHeadingHashPrefix(heading, headingDefaults(editor.children[0])) ? 'hash' : undefined
}

/** Protect heading owners and restrict subheadings to the controls they support. */
export function headingListControlDisabled(editor: Editor, includeSubheadings = false): boolean {
  if (!editor.selection) return false
  const headings = Editor.nodes(editor, {
    mode: 'all', match: node => isMainHeadingOrOwner(node) || includeSubheadings && isHeading(node),
  })
  let hasHeading = false
  for (const [node] of headings) {
    if (isNumberedHeading(node)) return false
    hasHeading = true
  }
  return hasHeading
}

export function headingListSelectionActive(editor:Editor,style:HeadingListStyle):boolean {
  if(!editor.selection)return false
  let hasHeading = false
  for (const [node, path] of Editor.nodes(editor, { match: isNumberedHeading })) {
    if (!isHeading(node) || currentHeadingStyle(editor, node, path) !== style) return false
    hasHeading = true
  }
  return hasHeading
}

/** Only selections containing main headings take this path; prose uses the existing commands. */
export function convertSelectedHeadingList(editor:Editor,style:HeadingListStyle,toggle:boolean):boolean {
  if(!editor.selection||editor.wysimark.readOnly)return false
  const selected=new Set([...Editor.nodes(editor,{match:isNumberedHeading})].map(([node])=>node))
  if(!selected.size)return false
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

function saveDefaults(editor: Editor, defaults: HeadingDefaults) {
  const current=headingDefaults(editor.children[0])
  if (current && headingLevels.every(level => current[level] === defaults[level])) return
  if (Element.isElement(editor.children[0])) Transforms.setNodes(editor, { __headingDefaults: defaults }, { at: [0] })
}

function setHeadingList(editor:Editor,path:Path,settings:NonNullable<Element['__headingList']>):void {
  const heading = Node.get(editor, path)
  if (!isHeading(heading)) return
  const numbered=settings.style==='number'&&settings.enabled
  const parentPath=path.slice(0,-1)
  const parent=parentPath.length?Node.get(editor,parentPath):undefined
  const owner=Element.isElement(parent)&&parent.type==='ordered-list-item'&&parent.blockChildren&&path[path.length-1]===0?parent:undefined
  const current = heading.__headingList
  if (heading.__blockDepth !== 0 || current?.style !== settings.style || current.enabled !== settings.enabled || current.levels) {
    Transforms.setNodes(editor, { __headingList: settings, __blockDepth: 0 }, { at: path })
  }
  if(numbered) {
    if(owner) {
      Transforms.setNodes(editor,{start:undefined,__firstAtDepth:undefined,__numbering:'continue',depth:0,__blockDepth:0},{at:parentPath})
    } else {
      Transforms.wrapNodes(editor,{
        type:'ordered-list-item',blockChildren:true,depth:0,__numbering:'continue',children:[],
      },{at:path})
    }
  } else if(owner) unwrapHeadingList(editor,path)
}
