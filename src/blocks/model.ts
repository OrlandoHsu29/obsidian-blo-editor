import { Editor, Element, Node, NodeEntry, Path, Point, Range, Transforms } from 'slate'
import { withHistoryBatch as batch } from '../wysimark/utils/with-history-batch'
import { isStructuredBlock } from './structured-block'

type Block = Element & { __blockDepth?: number; __numbering?: 'continue' | 'restart' | 'explicit'; __firstAtDepth?: boolean; depth?: number; start?: number }
export const MAX_BODY_LIST_NUMBER = 99
export const blockDepth = (node: Node): number => Element.isElement(node) ? Math.max(0, (node as Block).__blockDepth ?? (node as Block).depth ?? 0) : 0
export const isListBlock = (node: Node) => Element.isElement(node) && ['ordered-list-item','unordered-list-item','task-list-item'].includes(node.type)
export const isFoldableList = (node: Node) => Element.isElement(node)&&['ordered-list-item','unordered-list-item'].includes(node.type)
export const isEditorSpacer = (node: Node) => Element.isElement(node)&&node.type==='paragraph'&&node.__collapsible&&Node.string(node)===''
export function groupEnd(nodes: Node[], start: number) {
  let end=start+1;while(end<nodes.length&&(isEditorSpacer(nodes[end])||blockDepth(nodes[end])>blockDepth(nodes[start])))end++;return end
}
export type BlockHeading={node:Element;number?:number;numberLabel?:string;listIndex?:number}
type HeadingProjection={headings:{node:Element;listOffset?:number;numberedOwner?:Node}[];listCount:number}
const headingNodes=new WeakMap<Node,HeadingProjection>(),emptyHeadings:HeadingProjection={headings:[],listCount:0}
function blockHeadings(node:Node):HeadingProjection {
  if(!Element.isElement(node))return emptyHeadings
  if(node.type==='heading')return {headings:[{node}],listCount:0}
  if(isListBlock(node)&&!('blockChildren' in node&&node.blockChildren))return {headings:[],listCount:1}
  if(node.type!=='block-quote'&&!('blockChildren' in node&&node.blockChildren))return emptyHeadings
  let projection=headingNodes.get(node)
  if(!projection){
    projection={headings:[],listCount:0}
    const lists=new Map<Node,number>()
    for(const [element,path] of Node.elements(node)) {
      if(isListBlock(element))lists.set(element,projection.listCount++)
      if(element.type!=='heading')continue
      let listOffset:number|undefined,numberedOwner:Node|undefined
      for(let length=path.length-1;length>=0;length--){
        const parent=Node.get(node,path.slice(0,length))
        if(!isListBlock(parent))continue
        listOffset=lists.get(parent)
        if(Element.isElement(parent)&&parent.type==='ordered-list-item'&&parent.children[0]===element)numberedOwner=parent
        break
      }
      projection.headings.push({node:element,listOffset,numberedOwner})
    }
    headingNodes.set(node,projection)
  }
  return projection
}
const caches = new WeakMap<Editor,{children: Editor['children']; indices: Map<Node,number>; numbers: Map<Node,number>;numberLabels:Map<Node,string>;headings:BlockHeading[];listCount:number;listGuides:Map<Node,number>;foldable:Set<Node>;foldedBy:Map<Node,Node>;previousVisible:Map<Node,number>}>()
export function rootCache(editor: Editor) {
  let cache=caches.get(editor)
  if (!cache || cache.children!==editor.children) {
    const {numbers,numberLabels}=resolveOrderedNumbers(editor.children),indices=new Map<Node,number>(),headings:BlockHeading[]=[]
    const listGuides=new Map<Node,number>()
    const foldable=new Set<Node>(),foldedBy=new Map<Node,Node>(),previousVisible=new Map<Node,number>()
    let previous:Node|undefined,visible=-1,collapsed:Node|undefined,collapsedDepth=0
    let listCount=0,guideMask=0
    editor.children.forEach((node,index)=>{
      indices.set(node,index)
      if(isEditorSpacer(node)) {
        if(collapsed)foldedBy.set(node,collapsed)
      } else {
        const depth=blockDepth(node)
        if(previous&&depth>blockDepth(previous)&&isFoldableList(previous))foldable.add(previous)
        if(collapsed&&depth<=collapsedDepth)collapsed=undefined
        if(collapsed)foldedBy.set(node,collapsed)
        else {
          previousVisible.set(node,visible);visible=index
          if(Element.isElement(node)&&isFoldableList(node)&&node.__collapsed){collapsed=node;collapsedDepth=depth}
        }
        previous=node
      }
      const projection=blockHeadings(node)
      if(!isEditorSpacer(node)) {
        const depth=blockDepth(node)
        guideMask%=2**depth
        if(Element.isElement(node)&&!node.__subtitle&&!projection.headings.length) {
          if(depth>0&&guideMask)listGuides.set(node,guideMask)
          // Only body list parents start a guide; prose and widgets continue it.
          if(isListBlock(node)&&node.type!=='task-list-item')guideMask+=2**depth
        }
      }
      for(const heading of projection.headings)headings.push({node:heading.node,number:heading.numberedOwner?numbers.get(heading.numberedOwner):undefined,
        numberLabel:heading.numberedOwner?numberLabels.get(heading.numberedOwner):undefined,
        listIndex:heading.listOffset===undefined?undefined:listCount+heading.listOffset})
      listCount+=projection.listCount
    })
    // Body edits retain the outline projection when heading nodes/numbers are unchanged.
    const unchanged=cache?.headings.length===headings.length&&headings.every((heading,index)=>heading.node===cache!.headings[index].node&&heading.numberLabel===cache!.headings[index].numberLabel&&heading.listIndex===cache!.headings[index].listIndex)
    cache={children:editor.children,indices,numbers,numberLabels,headings:unchanged?cache!.headings:headings,listCount,listGuides,foldable,foldedBy,previousVisible};caches.set(editor,cache)
  }
  return cache
}
/** Paragraph style is the primary hierarchy; indentation scopes each style. */
export function listHeadingLevel(node: Node): number | undefined {
  if(!Element.isElement(node))return undefined
  if(node.__subtitle)return 5
  if(node.type==='heading')return node.level
  if(node.type==='ordered-list-item'&&node.blockChildren) {
    const first=node.children[0]
    if(Element.isElement(first)&&first.type==='heading')return first.level
  }
}
/** Titles, subtitles and their numbered owners always stay at root depth. */
export const canIndentBlock = (node: Node) => listHeadingLevel(node) === undefined
export function normalizeHeadingIndent(editor: Editor, [node,path]: NodeEntry): boolean {
  if (!Element.isElement(node) || canIndentBlock(node)) return false
  const block = node as Block
  if (!(block.__blockDepth || block.depth)) return false
  Transforms.setNodes(editor, { __blockDepth: 0, ...(block.depth !== undefined ? {depth:0} : {}) }, {at:path})
  return true
}
export function orderedNumbers(nodes: Node[]) {
  return resolveOrderedNumbers(nodes).numbers
}
/** Manual restart clears source starts; legacy automatic conversions retained them. */
const restartsNumbering = (node: Block) => node.__numbering === 'restart' && node.start === undefined
function alphabeticNumber(number: number): string {
  if(!Number.isSafeInteger(number)||number<1)return String(number)
  let label=''
  for(let value=number;value>0;value=Math.floor((value-1)/26))label=String.fromCharCode(97+(value-1)%26)+label
  return label
}
/** The nearest heading scopes numbering; an unnumbered heading blocks inherited paths. */
export function resolveOrderedNumbers(nodes: Node[]) {
  const counters=new Map<number,Map<number,number>>(), numbers=new Map<Node,number>(),numberLabels=new Map<Node,string>()
  const ancestors:{level:number;depth:number;path?:string}[]=[]
  for(const node of nodes) {
    if(isEditorSpacer(node))continue
    const headingLevel=listHeadingLevel(node)
    const style=headingLevel??7
    for(const level of counters.keys())if(level>style)counters.delete(level)
    const depth=blockDepth(node)
    if(headingLevel!==undefined)while(ancestors.length){
      const parent=ancestors[ancestors.length-1]
      if(parent.level<headingLevel||(parent.level===headingLevel&&parent.depth<depth))break
      ancestors.pop()
    }
    let counts=counters.get(style)
    if(!counts){counts=new Map();counters.set(style,counts)}
    // A same-style parent ends child series, even when the parent has no number.
    if(isListBlock(node)||headingLevel!==undefined)for(const level of counts.keys())if(level>depth)counts.delete(level)
    if(Element.isElement(node)&&node.type==='ordered-list-item') {
      const block=node as Block
      const number=block.__numbering==='explicit'&&block.start!==undefined?block.start:restartsNumbering(block)?1:(counts.get(depth)||0)+1
      counts.set(depth,number);numbers.set(node,number)
      // Subtitles use an independent lowercase alphabetic sequence.
      if(headingLevel===5)numberLabels.set(node,`${alphabeticNumber(number)}.`)
      else if(headingLevel===undefined)numberLabels.set(node,`${number}.`)
      else {
        const parent=ancestors[ancestors.length-1]?.path
        const path=parent?`${parent}.${number}`:String(number)
        numberLabels.set(node,parent?path:`${number}.`)
        ancestors.push({level:headingLevel,depth,path})
      }
    } else if(headingLevel!==undefined&&headingLevel!==5)ancestors.push({level:headingLevel,depth})
  }
  return {numbers,numberLabels}
}
function depthProps(node: Node, depth: number) {return isEditorSpacer(node)?{}:isListBlock(node)?{depth,__blockDepth:depth}:{__blockDepth:depth}}
/** Tab moves quote blocks and their descendants; it never wraps another quote. */
export function indentSelectedQuoteBlocks(editor:Editor,delta:1|-1):boolean {
  return indentSelection(editor,delta,true)
}
/** Every root block has the same indentation and subtree movement behavior. */
export function indentSelectedBlocks(editor:Editor,delta:1|-1):boolean {
  return indentSelection(editor,delta,false)
}
function indentSelection(editor:Editor,delta:1|-1,quotesOnly:boolean):boolean {
  const indices=selectedRootBlocks(editor)
  if(!indices.length||indices.some(({node})=>!Element.isElement(node)||(quotesOnly&&node.type!=='block-quote')))return false
  return indentBlockGroups(editor,indices.map(({index})=>index),delta)
}
/** Selection end at the next block's start does not include that block. */
export function selectedRootBlocks(editor:Editor) {
  if(editor.wysimark.readOnly||!editor.selection)return []
  const [start,end]=Range.edges(editor.selection)
  const endsBeforeBlock=Range.isExpanded(editor.selection)&&end.path[0]>start.path[0]&&Point.equals(end,Editor.start(editor,[end.path[0]]))
  return editor.children.slice(start.path[0],end.path[0]+(endsBeforeBlock?0:1)).map((node,offset)=>({node,index:start.path[0]+offset})).filter(({node})=>!isEditorSpacer(node))
}
function indentBlockGroups(editor:Editor,indices:number[],delta:1|-1):boolean {
  if(editor.wysimark.readOnly||!indices.length)return false
  const groups:{start:number;end:number}[]=[]
  for(const index of indices)if(!groups.length||index>=groups[groups.length-1].end)groups.push({start:index,end:groupEnd(editor.children,index)})
  if(groups.some(group=>editor.children.slice(group.start,group.end).some(node=>!canIndentBlock(node))))return true
  if(delta>0&&groups.some(group=>editor.children.slice(group.start,group.end).some(node=>blockDepth(node)>=32)))return true
  batch(editor,()=>{for(const group of groups){if(delta<0&&blockDepth(editor.children[group.start])===0)continue;for(let i=group.start;i<group.end;i++)Transforms.setNodes(editor,depthProps(editor.children[i],blockDepth(editor.children[i])+delta),{at:[i]})}})
  return true
}
export function changeBlockIndent(editor: Editor, index: number, delta: 1|-1) {
  if(editor.wysimark.readOnly||!editor.children[index]||isEditorSpacer(editor.children[index]))return false
  if(!canIndentBlock(editor.children[index]))return false
  if(delta<0&&blockDepth(editor.children[index])===0)return false
  return indentBlockGroups(editor,[index],delta)
}
/** Remove the same subtree that the block handle selects, as one undo step. */
export function deleteBlockGroup(editor: Editor, index: number, selectedEnd?: number): boolean {
  if(editor.wysimark.readOnly||!editor.children[index]||isEditorSpacer(editor.children[index]))return false
  const removed=editor.children[index]
  const end=selectedEnd??groupEnd(editor.children,index)
  const wholeDocument=selectedEnd!==undefined&&index===0&&end===editor.children.length
  batch(editor,()=>{
    for(let i=end-1;i>=index;i--)Transforms.removeNodes(editor,{at:[i]})
    // Restore a durable input row at the removed block, instead of accepting
    // Slate's fallback caret inside the preceding heading/table/code block.
    if(isStructuredBlock(removed)) {
      Transforms.insertNodes(editor,{type:'paragraph',__blockDepth:wholeDocument?0:blockDepth(removed),children:[{text:''}]},{at:[index]})
      Transforms.select(editor,Editor.start(editor,[index]))
      editor.marks=null
      return
    }
    if(!editor.children.length)Transforms.insertNodes(editor,{type:'paragraph',children:[{text:''}]},{at:[0]})
    const target=Math.min(index,editor.children.length-1),node=editor.children[target]
    // Structured neighbors stay selected rather than unexpectedly entering a cell or code.
    const range=Editor.range(editor,[target])
    Transforms.select(editor,Element.isElement(node)&&editor.isMaster(node)
      ?range:target<index?range.focus:range.anchor)
  })
  return true
}
export type BlockDragGroup={children:Node[];from:number;end:number;depth:number;maxRelativeDepth:number;maxDepth:number;ends:Map<number,number>}
export function blockDragGroup(children:Node[],from:number,selectedEnd=from+1):BlockDragGroup|undefined {
  if(!children[from]||isEditorSpacer(children[from]))return
  let end=groupEnd(children,from)
  while(end<Math.min(selectedEnd,children.length))end=groupEnd(children,end)
  let depth=blockDepth(children[from])
  for(let i=from;i<end;i++)if(!isEditorSpacer(children[i]))depth=Math.min(depth,blockDepth(children[i]))
  let maxRelativeDepth=0
  for(let i=from;i<end;i++)if(!isEditorSpacer(children[i]))maxRelativeDepth=Math.max(maxRelativeDepth,blockDepth(children[i])-depth)
  const maxDepth=children.slice(from,end).some(node=>!canIndentBlock(node))?0:32-maxRelativeDepth
  return {children,from,end,depth,maxRelativeDepth,maxDepth,ends:new Map([[from,end]])}
}
/** A handle inside a multi-block text selection drags every selected subtree. */
export function selectedBlockDragGroup(editor:Editor,index:number):BlockDragGroup|undefined {
  const selection=editor.selection
  if(selection&&Range.isExpanded(selection)) {
    const [start,end]=Range.edges(selection)
    const last=end.path[0]-(end.path[0]>start.path[0]&&Point.equals(end,Editor.start(editor,[end.path[0]]))?1:0)
    if(last>start.path[0]&&index>=start.path[0]&&index<=last)return blockDragGroup(editor.children,start.path[0],last+1)
  }
  return blockDragGroup(editor.children,index)
}
/** Share the exact insertion boundary and depth between the guide and the move. */
export function blockDropTarget(group:BlockDragGroup,target:number,position:'before'|'inside'|'after',requestedDepth?:number) {
  const {children,from,end}=group
  if(!children[target]||isEditorSpacer(children[target]))return
  const source=target>=from&&target<end
  const targetDepth=source?group.depth:blockDepth(children[target])
  const requested=requestedDepth??targetDepth+(position==='inside'?1:0)
  if(!Number.isFinite(requested))return
  const desired=Math.max(0,Math.min(group.maxDepth,Math.round(requested)))
  let destination=source?from:target
  if(!source&&position!=='before') {
    if(target!==from&&desired>targetDepth)destination=target+1
    else {
      let last=group.ends.get(target)
      if(last===undefined){last=groupEnd(children,target);group.ends.set(target,last)}
      destination=last
    }
  }
  // Find the preceding real block after removing the source subtree.
  let previous=destination-1
  while(previous>=0) {
    if(previous>=from&&previous<end){previous=from-1;continue}
    if(!isEditorSpacer(children[previous]))break
    previous--
  }
  const maxDepth=Math.min(group.maxDepth,previous<0?0:blockDepth(children[previous])+1)
  const depth=Math.min(desired,maxDepth)
  return {destination,depth,maxDepth,previous}
}
export function moveBlockGroup(editor: Editor, from: number, target: number, position:'before'|'inside'|'after',requestedDepth?:number,selectedEnd=from+1) {
  if(editor.wysimark.readOnly)return false
  const group=blockDragGroup(editor.children,from,selectedEnd)
  if(!group)return false
  const drop=blockDropTarget(group,target,position,requestedDepth)
  if(!drop)return false
  const {end}=group,{destination,depth}=drop,delta=depth-group.depth
  const nodes=editor.children.slice(from,end).map(node=>({...node,...depthProps(node,blockDepth(node)+delta)}))
  const adjusted=destination>end-1?destination-(end-from):destination
  if(adjusted===from&&delta===0)return false
  batch(editor,()=>{
    for(let i=end-1;i>=from;i--)Transforms.removeNodes(editor,{at:[i]})
    Transforms.insertNodes(editor,nodes,{at:[adjusted]})
    Transforms.select(editor,Editor.start(editor,[adjusted]))
  });return true
}
export function setNumbering(editor: Editor, index: number, mode:'continue'|'restart') {
  const node=editor.children[index]
  if(editor.wysimark.readOnly||!Element.isElement(node)||node.type!=='ordered-list-item')return
  batch(editor,()=>{Transforms.unsetNodes(editor,'start',{at:[index]});Transforms.setNodes(editor,{__numbering:mode},{at:[index]})})
}
/** Connected default lists are dynamic; source starts must not pin old numbers after a conversion. */
export function reflowFollowingLists(editor: Editor, path: Path, depth = blockDepth(Node.get(editor,path))) {
  const parent=Node.parent(editor,path),parentPath=Path.parent(path)
  const style=listHeadingLevel(Node.get(editor,path))??7
  for(let i=path[path.length-1]+1;i<parent.children.length;i++) {
    const node=parent.children[i]
    if(isEditorSpacer(node))continue
    const nextStyle=listHeadingLevel(node)??7
    if(nextStyle<style)break
    if(nextStyle>style)continue
    if(blockDepth(node)<depth)break
    if(blockDepth(node)!==depth)continue
    if(!Element.isElement(node)||node.type!=='ordered-list-item')continue
    if(restartsNumbering(node as Block)||node.__numbering==='explicit')break
    const at=[...parentPath,i]
    Transforms.unsetNodes(editor,'start',{at})
  }
}
/** Normalize actual text, including native DOM insertions, paste and formatted prefixes. */
export function normalizeOrderedText(editor: Editor, [node,path]: NodeEntry): boolean {
  if(editor.wysimark.readOnly||!Element.isElement(node)||!['paragraph','heading','unordered-list-item','task-list-item','ordered-list-item'].includes(node.type)||('blockChildren' in node&&node.blockChildren))return false
  // Explicitly escaped source text stays literal until that block's text is edited.
  if(node.__literalOrderedText===Node.string(node))return false
  const match=Node.string(node).match(/^(\d{1,6})\. /)
  if(!match||Number(match[1])<1)return false
  if(listHeadingLevel(node)===undefined&&Number(match[1])>MAX_BODY_LIST_NUMBER)return false
  let prefixLength=match[0].length
  for(const [text] of Node.texts(node)){if(prefixLength<=0)break;if(text.text.length&&text.code)return false;prefixLength-=text.text.length}
  const start=Editor.start(editor,path),end=Editor.after(editor,start,{distance:match[0].length,unit:'offset'})
  if(!end)return false
  Editor.withoutNormalizing(editor,()=>{
    Transforms.delete(editor,{at:{anchor:start,focus:end}})
    let listPath=path
    if(node.type==='heading') {
      const containing=Editor.above(editor,{at:path,match:n=>Element.isElement(n)&&n.type==='ordered-list-item'})
      if(containing) {
        listPath=containing[1]
        Transforms.setNodes(editor,{start:Number(match[1]),__numbering:'explicit'},{at:listPath})
      } else {
        Transforms.wrapNodes(editor,{
          type:'ordered-list-item',depth:blockDepth(node),blockChildren:true,
          start:Number(match[1]),__numbering:'explicit',children:[],
        },{at:path})
      }
    } else {
      Transforms.setNodes(editor,{type:'ordered-list-item',depth:blockDepth(node),start:Number(match[1]),__numbering:'explicit'},{at:path})
    }
    Transforms.unsetNodes(editor,'__literalOrderedText',{at:node.type==='heading'?[...listPath,0]:listPath})
    reflowFollowingLists(editor,listPath,blockDepth(node))
  });return true
}
