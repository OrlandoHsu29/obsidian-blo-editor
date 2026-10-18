import { Editor, Element, Node, NodeEntry, Path, Point, Range, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'

type Block = Element & { __blockDepth?: number; __numbering?: 'continue' | 'restart'; __firstAtDepth?: boolean; depth?: number; start?: number }
export const blockDepth = (node: Node): number => Element.isElement(node) ? Math.max(0, (node as Block).__blockDepth ?? (node as Block).depth ?? 0) : 0
export const isListBlock = (node: Node) => Element.isElement(node) && ['ordered-list-item','unordered-list-item','task-list-item'].includes(node.type)
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
const caches = new WeakMap<Editor,{children: Editor['children']; indices: Map<Node,number>; numbers: Map<Node,number>;numberLabels:Map<Node,string>;headings:BlockHeading[];listCount:number}>()
export function rootCache(editor: Editor) {
  let cache=caches.get(editor)
  if (!cache || cache.children!==editor.children) {
    const {numbers,numberLabels}=resolveOrderedNumbers(editor.children),indices=new Map<Node,number>(),headings:BlockHeading[]=[]
    let listCount=0
    editor.children.forEach((node,index)=>{
      indices.set(node,index)
      const projection=blockHeadings(node)
      for(const heading of projection.headings)headings.push({node:heading.node,number:heading.numberedOwner?numbers.get(heading.numberedOwner):undefined,
        numberLabel:heading.numberedOwner?numberLabels.get(heading.numberedOwner):undefined,
        listIndex:heading.listOffset===undefined?undefined:listCount+heading.listOffset})
      listCount+=projection.listCount
    })
    // Body edits retain the outline projection when heading nodes/numbers are unchanged.
    const unchanged=cache?.headings.length===headings.length&&headings.every((heading,index)=>heading.node===cache!.headings[index].node&&heading.numberLabel===cache!.headings[index].numberLabel&&heading.listIndex===cache!.headings[index].listIndex)
    cache={children:editor.children,indices,numbers,numberLabels,headings:unchanged?cache!.headings:headings,listCount};caches.set(editor,cache)
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
export function orderedNumbers(nodes: Node[]) {
  return resolveOrderedNumbers(nodes).numbers
}
/** Display paths include numbered heading ancestors only; Markdown keeps local integers. */
export function resolveOrderedNumbers(nodes: Node[]) {
  const counters=new Map<number,Map<number,number>>(), numbers=new Map<Node,number>(),numberLabels=new Map<Node,string>()
  const ancestors:{level:number;depth:number;path:string}[]=[]
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
    for(const level of counts.keys())if(level>depth)counts.delete(level)
    if(Element.isElement(node)&&node.type==='ordered-list-item') {
      const block=node as Block
      const number=block.__numbering==='restart'||(headingLevel===undefined&&!block.__numbering&&block.__firstAtDepth)?1:(counts.get(depth)||0)+1
      counts.set(depth,number);numbers.set(node,number)
      if(headingLevel===undefined)numberLabels.set(node,`${number}.`)
      else {
        const parent=ancestors[ancestors.length-1]
        const path=parent?`${parent.path}.${number}`:String(number)
        numberLabels.set(node,parent?path:`${number}.`)
        ancestors.push({level:headingLevel,depth,path})
      }
    }
  }
  return {numbers,numberLabels}
}
/** A new list restarts unless the preceding meaningful sibling is also numbered. */
export function defaultOrderedNumbering(editor: Editor, path: Path, converting?: ReadonlySet<Node>): 'continue'|'restart' {
  const parent=Node.parent(editor,path)
  let previous=path[path.length-1]-1
  while(previous>=0&&isEditorSpacer(parent.children[previous]))previous--
  const node=parent.children[previous]
  return node&&(Element.isElement(node)&&node.type==='ordered-list-item'||converting?.has(node))?'continue':'restart'
}
function batch(editor: Editor, run: ()=>void) {
  const apply=()=>Editor.withoutNormalizing(editor,run)
  if(HistoryEditor.isHistoryEditor(editor))HistoryEditor.withNewBatch(editor,apply);else apply()
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
  if(editor.wysimark.readOnly||!editor.selection)return false
  const [start,end]=Range.edges(editor.selection)
  const endsBeforeBlock=Range.isExpanded(editor.selection)&&end.path[0]>start.path[0]&&Point.equals(end,Editor.start(editor,[end.path[0]]))
  const indices=editor.children.map((node,index)=>({node,index})).slice(start.path[0],end.path[0]+(endsBeforeBlock?0:1)).filter(({node})=>!isEditorSpacer(node))
  if(!indices.length||indices.some(({node})=>!Element.isElement(node)||(quotesOnly&&node.type!=='block-quote')))return false
  return indentBlockGroups(editor,indices.map(({index})=>index),delta)
}
function indentBlockGroups(editor:Editor,indices:number[],delta:1|-1):boolean {
  if(editor.wysimark.readOnly||!indices.length)return false
  const groups:{start:number;end:number}[]=[]
  for(const index of indices)if(!groups.length||index>=groups[groups.length-1].end)groups.push({start:index,end:groupEnd(editor.children,index)})
  if(delta>0&&groups.some(group=>editor.children.slice(group.start,group.end).some(node=>blockDepth(node)>=32)))return true
  batch(editor,()=>{for(const group of groups){if(delta<0&&blockDepth(editor.children[group.start])===0)continue;for(let i=group.start;i<group.end;i++)Transforms.setNodes(editor,depthProps(editor.children[i],blockDepth(editor.children[i])+delta),{at:[i]})}})
  return true
}
export function changeBlockIndent(editor: Editor, index: number, delta: 1|-1) {
  if(editor.wysimark.readOnly||!editor.children[index]||isEditorSpacer(editor.children[index]))return false
  if(delta<0&&blockDepth(editor.children[index])===0)return false
  return indentBlockGroups(editor,[index],delta)
}
/** Remove the same subtree that the block handle selects, as one undo step. */
export function deleteBlockGroup(editor: Editor, index: number): boolean {
  if(editor.wysimark.readOnly||!editor.children[index]||isEditorSpacer(editor.children[index]))return false
  const end=groupEnd(editor.children,index)
  batch(editor,()=>{
    for(let i=end-1;i>=index;i--)Transforms.removeNodes(editor,{at:[i]})
    if(!editor.children.length)Transforms.insertNodes(editor,{type:'paragraph',children:[{text:''}]},{at:[0]})
    const target=Math.min(index,editor.children.length-1),node=editor.children[target]
    // Structured neighbors stay selected rather than unexpectedly entering a cell or code.
    const range=Editor.range(editor,[target])
    Transforms.select(editor,Element.isElement(node)&&editor.isMaster(node)
      ?range:target<index?range.focus:range.anchor)
  })
  return true
}
export type BlockDragGroup={children:Node[];from:number;end:number;depth:number;maxRelativeDepth:number;ends:Map<number,number>}
export function blockDragGroup(children:Node[],from:number):BlockDragGroup|undefined {
  if(!children[from]||isEditorSpacer(children[from]))return
  const end=groupEnd(children,from),depth=blockDepth(children[from])
  let maxRelativeDepth=0
  for(let i=from;i<end;i++)if(!isEditorSpacer(children[i]))maxRelativeDepth=Math.max(maxRelativeDepth,blockDepth(children[i])-depth)
  return {children,from,end,depth,maxRelativeDepth,ends:new Map([[from,end]])}
}
/** Share the exact insertion boundary and depth between the guide and the move. */
export function blockDropTarget(group:BlockDragGroup,target:number,position:'before'|'inside'|'after',requestedDepth?:number) {
  const {children,from,end}=group
  if(!children[target]||isEditorSpacer(children[target])||(target>from&&target<end))return
  const targetDepth=blockDepth(children[target])
  const requested=requestedDepth??targetDepth+(position==='inside'?1:0)
  if(!Number.isFinite(requested))return
  const desired=Math.max(0,Math.min(32-group.maxRelativeDepth,Math.round(requested)))
  let destination=target
  if(position!=='before') {
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
  const maxDepth=Math.min(32-group.maxRelativeDepth,previous<0?0:blockDepth(children[previous])+1)
  const depth=Math.min(desired,maxDepth)
  return {destination,depth,maxDepth}
}
export function moveBlockGroup(editor: Editor, from: number, target: number, position:'before'|'inside'|'after',requestedDepth?:number) {
  if(editor.wysimark.readOnly)return false
  const group=blockDragGroup(editor.children,from)
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
    if(node.__numbering==='restart')break
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
        Transforms.setNodes(editor,{start:Number(match[1]),__numbering:defaultOrderedNumbering(editor,listPath)},{at:listPath})
      } else {
        Transforms.wrapNodes(editor,{
          type:'ordered-list-item',depth:blockDepth(node),blockChildren:true,
          start:Number(match[1]),__numbering:defaultOrderedNumbering(editor,path),children:[],
        },{at:path})
      }
    } else {
      Transforms.setNodes(editor,{type:'ordered-list-item',depth:blockDepth(node),start:Number(match[1]),__numbering:defaultOrderedNumbering(editor,path)},{at:path})
    }
    Transforms.unsetNodes(editor,'__literalOrderedText',{at:node.type==='heading'?[...listPath,0]:listPath})
    reflowFollowingLists(editor,listPath,blockDepth(node))
  });return true
}
