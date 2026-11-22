import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { Menu } from 'obsidian'
import { Element, Node } from 'slate'
import type { Editor } from 'slate'
import { ReactEditor, useReadOnly, useSlateSelector, useSlateStatic } from 'slate-react'
import { ui } from '../wysimark/utils/translations'
import { blockDepth, blockDragGroup, blockDropTarget, groupEnd, isEditorSpacer, isListBlock, moveBlockGroup, quoteContentIndent, rootCache, selectedBlockDragGroup } from './model'
import type { BlockDragGroup } from './model'
import { useFirstLineAlignment } from './first-line-alignment'
import { blockGap } from './typography'
import { clearBlockSelection, selectBlockContents, selectImageWithModifier } from './selection'
import { showBlockMenu } from './block-menu'
import { startBlockDragAutoScroll } from './drag-auto-scroll'
import { BlockHighlight, highlightBlockDrag } from './block-highlight'
import { toggleBlockFold } from './folding'
import { mediaContentSelector } from './structured-block'
import { canDropImage, imageRowDropTarget, insertImageRow, moveImageToBlock } from './image-row'
import { isRowImage } from '../wysimark/image-plugin/row-model'
import { isQuoteContent } from './quote-indent'

type DropPosition = 'before' | 'after'
type DropPreview={position:DropPosition;depth:number;maxDepth?:number;origin:number;step:number;left:number;top:number}
type BlockDragEvent={currentTarget:HTMLDivElement;clientX:number;clientY:number;dataTransfer?:DataTransfer|null;preventDefault:()=>void;stopPropagation:()=>void}
type DragHandlers={over:(event:BlockDragEvent)=>void;drop:(event:BlockDragEvent)=>void}
const dragHandlers=new WeakMap<HTMLElement,{current:DragHandlers|null}>()
const dragging = new WeakMap<Editor, {node:Node;lastNode:Node;group:BlockDragGroup;image?:Element;previewNode?:Element;clearPreview?:()=>void;cleanup?:()=>void}>()

function endBlockDrag(editor:Editor) {
  const state=dragging.get(editor)
  dragging.delete(editor)
  state?.clearPreview?.();state?.cleanup?.()
}

function imageDragGroup(editor:Editor,image:Element):BlockDragGroup|undefined {
  try {
    const path=ReactEditor.findPath(editor,image)
    if(Node.getIf(editor,path)!==image)return
    const root=editor.children[path[0]]
    if(path.length!==1 && (path.length!==2 || !Element.isElement(root) || root.type!=='image-row'))return
    const group=blockDragGroup(editor.children,path[0])
    // Moving a child leaves the enclosing image row in the document.
    return group&&path.length===2?{...group,end:group.from,maxDepth:32}:group
  } catch { return }
}

export function startImageDrag(editor:Editor,image:Element):boolean {
  const group=imageDragGroup(editor,image)
  if(!group)return false
  endBlockDrag(editor)
  const doc=ReactEditor.toDOMNode(editor,editor).ownerDocument
  const stopGutter=listenToDragGutter(editor)
  const end=()=>endBlockDrag(editor)
  doc.addEventListener('dragend',end,true)
  dragging.set(editor,{image,node:editor.children[group.from],lastNode:editor.children[Math.max(group.from,group.end-1)],group,
    cleanup:()=>{stopGutter();doc.removeEventListener('dragend',end,true)}})
  return true
}

/** Route drops in the indentation gutter to the block at the same height. */
function listenToDragGutter(editor:Editor) {
  const editable=ReactEditor.toDOMNode(editor,editor),doc=editable.ownerDocument,win=doc.defaultView!
  const surface=editable.closest('.wysimark-editor-container')??editable
  let children=editor.children,roots=Array.from(editable.querySelectorAll<HTMLDivElement>('[data-wysimark-block]:not([data-block-fold-hidden="true"])'))
  const blockAtPoint=(clientX:number,clientY:number)=>{
    const direct=doc.elementFromPoint(clientX,clientY)?.closest<HTMLDivElement>('[data-wysimark-block]')
    if(direct&&editable.contains(direct))return direct
    const rect=editable.getBoundingClientRect(),padding=parseFloat(win.getComputedStyle(editable).paddingRight)||0
    const x=Math.min(win.innerWidth-2,rect.right-padding-2)
    const root=doc.elementFromPoint(x,clientY)?.closest<HTMLDivElement>('[data-wysimark-block]')
    if(root&&editable.contains(root))return root
    if(children!==editor.children){children=editor.children;roots=Array.from(editable.querySelectorAll<HTMLDivElement>('[data-wysimark-block]:not([data-block-fold-hidden="true"])'))}
    // Margins and chunk gutters are valid drop areas. Locate the closest row
    // with logarithmic measurements rather than scanning the document per event.
    let low=0,high=roots.length
    while(low<high){const mid=(low+high)>>>1;if(roots[mid].getBoundingClientRect().bottom<clientY)low=mid+1;else high=mid}
    const next=roots[low],previous=roots[low-1]
    if(!next)return previous
    if(!previous)return next
    return clientY-previous.getBoundingClientRect().bottom<next.getBoundingClientRect().top-clientY?previous:next
  }
  const stopScroll=startBlockDragAutoScroll(editable,(clientX,clientY)=>{
    const root=blockAtPoint(clientX,clientY)
    if(root)dragHandlers.get(root)?.current?.over({currentTarget:root,clientX,clientY,preventDefault:()=>{},stopPropagation:()=>{}})
  })
  const forward=(event:globalThis.DragEvent)=>{
    const target=event.target as HTMLElement
    if(target.closest?.('[data-wysimark-block]'))return
    const root=blockAtPoint(event.clientX,event.clientY)
    if(!root)return
    const handlers=dragHandlers.get(root)?.current
    const handler=event.type==='drop'?handlers?.drop:handlers?.over
    handler?.({currentTarget:root,clientX:event.clientX,clientY:event.clientY,dataTransfer:event.dataTransfer,
      preventDefault:()=>event.preventDefault(),stopPropagation:()=>event.stopPropagation()})
  }
  // Native dragleave may have a null relatedTarget when only crossing a child.
  // Keep the last valid preview until an event actually targets another surface.
  const clearPreview=()=>dragging.get(editor)?.clearPreview?.()
  const clearOutside=(event:globalThis.DragEvent)=>{if(!surface.contains(event.target as globalThis.Node))clearPreview()}
  const visibility=()=>{if(doc.hidden)clearPreview()}
  doc.addEventListener('dragenter',clearOutside,true);doc.addEventListener('dragover',clearOutside,true);doc.addEventListener('drop',clearOutside,true)
  win.addEventListener('blur',clearPreview);doc.addEventListener('visibilitychange',visibility)
  surface.addEventListener('dragenter',forward);surface.addEventListener('dragover',forward);surface.addEventListener('drop',forward)
  return()=>{
    stopScroll();surface.removeEventListener('dragenter',forward);surface.removeEventListener('dragover',forward);surface.removeEventListener('drop',forward)
    doc.removeEventListener('dragenter',clearOutside,true);doc.removeEventListener('dragover',clearOutside,true);doc.removeEventListener('drop',clearOutside,true)
    win.removeEventListener('blur',clearPreview);doc.removeEventListener('visibilitychange',visibility)
  }
}

function dropPosition(event: BlockDragEvent): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect()
  const fraction = (event.clientY - rect.top) / Math.max(1, rect.height)
  return fraction < .5 ? 'before' : 'after'
}

function renderedBlock(editor:Editor,node:Node) {
  try { return ReactEditor.toDOMNode(editor,node).closest<HTMLElement>('[data-wysimark-block]') }
  catch { return null }
}

function imageDropLineY(editor:Editor,destination:number,currentTarget:HTMLDivElement,index:number,fallback:number,edgeInset:number) {
  const {children}=editor,{foldedBy}=rootCache(editor)
  const adjacentBlock=(start:number,step:number)=>{
    for(let i=start;i>=0&&i<children.length;i+=step) {
      const node=children[i]
      if(isEditorSpacer(node)||foldedBy.has(node))continue
      if(i===index)return currentTarget
      // A neighbor outside the render window may have no DOM yet.
      return renderedBlock(editor,node)
    }
    return null
  }
  const previous=adjacentBlock(destination-1,-1),next=adjacentBlock(destination,1)
  const bottom=previous?.getBoundingClientRect().bottom
  const nextBounds=next?.getBoundingClientRect()
  let top=nextBounds?.top
  if(next&&nextBounds&&next.dataset.blockType==='table') {
    const gutter=parseFloat(getComputedStyle(next).getPropertyValue('--blo-table-top-gutter'))||0
    top=nextBounds.top+gutter*(next.offsetHeight?nextBounds.height/next.offsetHeight:1)
  }
  if(bottom!==undefined&&top!==undefined)return (bottom+top)/2
  return bottom!==undefined?bottom+edgeInset:top!==undefined?top-edgeInset:fallback
}

export function RootBlock({ element, children }: { element: Element; children: ReactNode }) {
  const editor = useSlateStatic()
  const readOnly = useReadOnly()
  const foldLabelId = useId()
  // A preceding block can change without Slate re-rendering this element.
  const { index, gap, guideMask, previousGuides, foldable, foldHidden, taskCompleted } = useSlateSelector(useCallback((editor: Editor) => {
    const cache=rootCache(editor),index = cache.indices.get(element)
    const previous=cache.previousVisible.get(element)??-1,prior=editor.children[previous],foldHidden=cache.foldedBy.has(element)
    return { index,foldHidden,taskCompleted:cache.completedTasks.has(element),foldable:cache.foldable.has(element),guideMask:foldHidden?0:cache.listGuides.get(element)??0,previousGuides:prior?cache.listGuides.get(prior)??0:0,
      gap:index===undefined||isEditorSpacer(element)||foldHidden?'0px':blockGap(editor.children,index,previous) }
  }, [element]), (previous, next) => previous?.index === next.index && previous?.gap === next.gap && previous?.guideMask === next.guideMask && previous?.previousGuides === next.previousGuides && previous?.foldable === next.foldable && previous?.foldHidden === next.foldHidden && previous?.taskCompleted === next.taskCompleted)
  const depth = blockDepth(element)
  const guideDepth=Math.max(depth,quoteContentIndent(element))
  const guideLevels=guideMask?Array.from({length:guideDepth},(_,level)=>level).filter(level=>Math.floor(guideMask/2**level)%2===1):[]
  const [drop, setDrop] = useState<DropPreview | null>(null)
  const [imageDrop,setImageDrop]=useState<ReturnType<typeof imageRowDropTarget>|null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const imageModifierClick = useRef(false)
  const foldMotion = useRef({ hidden: foldHidden, enabled: false })
  const animateFold = foldMotion.current.enabled || foldMotion.current.hidden !== foldHidden
  useLayoutEffect(() => { foldMotion.current = { hidden: foldHidden, enabled: animateFold } }, [foldHidden, animateFold])
  const handlers=useRef<DragHandlers|null>(null)
  const menu = useRef<Menu | null>(null)
  const didDrag = useRef(false)
  const pendingDrag = useRef<{group:BlockDragGroup;start:()=>void;clear:()=>void}|null>(null)
  const alignHandle = useFirstLineAlignment(ref, '--wysimark-handle-center', true,
    index !== undefined && !isEditorSpacer(element) && !foldHidden)

  useEffect(() => () => {
    menu.current?.hide()
    pendingDrag.current?.clear();pendingDrag.current=null
    const state=dragging.get(editor)
    if(state?.node===element){state.clearPreview?.();state.cleanup?.();dragging.delete(editor)}
  }, [editor,element])
  useLayoutEffect(()=>{
    const root=ref.current;if(!root)return
    dragHandlers.set(root,handlers)
    return()=>{dragHandlers.delete(root)}
  },[index!==undefined&&!isEditorSpacer(element)])
  if (index === undefined || isEditorSpacer(element)) {
    if (element.type !== 'block-quote' && !editor.isInline(element) && isQuoteContent(editor, ReactEditor.findPath(editor, element))) {
      const indent = (element.__quoteIndent ?? 0) * 2
      return <div style={{ marginInlineStart: `max(0em, ${indent}em - var(--blo-shared-quote-indent, 0em))` }}>{children}</div>
    }
    return <>{children}</>
  }

  const selectAndOpenMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    pendingDrag.current?.clear();pendingDrag.current=null
    if (didDrag.current && event.detail > 0) return
    if (!selectBlockContents(editor, index)) return
    ReactEditor.focus(editor)
    menu.current?.hide()
    menu.current = showBlockMenu(editor, index, event.currentTarget)
  }

  const dropTarget=(event:BlockDragEvent)=>{
    const state=dragging.get(editor)
    if(!state)return
    if(state.group.children!==editor.children) {
      const indices=rootCache(editor).indices,from=indices.get(state.node),last=indices.get(state.lastNode)
      const group=state.image?imageDragGroup(editor,state.image):from===undefined||last===undefined?undefined:blockDragGroup(editor.children,from,last+1)
      if(!group)return
      state.group=group
    }
    const rect=event.currentTarget.getBoundingClientRect(),style=getComputedStyle(event.currentTarget)
    if(state.image && index===state.group.from && event.clientY>=rect.top+8 && event.clientY<=rect.bottom-8)return
    const scale=event.currentTarget.offsetWidth?rect.width/event.currentTarget.offsetWidth:1
    const unit=2*parseFloat(style.fontSize)*(scale||1)
    const origin=rect.left-(isListBlock(element)?0:depth*unit)
    const position=dropPosition(event)
    const target=blockDropTarget(state.group,index,position,state.image?0:(event.clientX-origin)/unit)
    if(!target)return
    const cache=rootCache(editor)
    let anchor=target.previous,before=anchor<0
    if(before){anchor=target.destination;while(anchor<editor.children.length&&(isEditorSpacer(editor.children[anchor])||anchor>=state.group.from&&anchor<state.group.end))anchor++;if(anchor>=editor.children.length)anchor=state.group.from}
    const owner=cache.foldedBy.get(editor.children[anchor])
    if(owner)anchor=cache.indices.get(owner)!
    const anchorDOM=anchor===index?event.currentTarget:renderedBlock(editor,editor.children[anchor])
    const bounds=anchorDOM?.getBoundingClientRect()??rect
    const edge=(anchorDOM?before:position==='before')?bounds.top:bounds.bottom
    const lineY=state.image?imageDropLineY(editor,target.destination,event.currentTarget,index,edge,unit*.2):edge
    return {position:before?'before' as const:'after' as const,destination:target.destination,depth:target.depth,maxDepth:state.image?undefined:target.maxDepth,
      origin:(origin-rect.left)/(scale||1),step:unit/(scale||1),
      left:(origin+target.depth*unit-rect.left)/(scale||1),top:(lineY-rect.top)/(scale||1)}
  }

  const onDrop = (event: BlockDragEvent) => {
    const state = dragging.get(editor)
    if (!state) return
    event.preventDefault()
    event.stopPropagation()
    try {
      const from = rootCache(editor).indices.get(state.node)
      const side = sideTarget(event)
      const target=side?undefined:dropTarget(event)
      if(event.dataTransfer)event.dataTransfer.dropEffect=target||side?'move':'none'
      const source = state.image ? imageDragGroup(editor,state.image) && ReactEditor.findPath(editor,state.image) : from === undefined ? undefined : [from]
      if(!source)return
      const image = state.image ?? state.node
      const moved = side ? isRowImage(image) && insertImageRow(editor,side,[image],source) :
        target && (source.length===2 ? moveImageToBlock(editor,source,target.destination,target.depth) :
          moveBlockGroup(editor,source[0],index,dropPosition(event),target.depth,state.group.end))
      if(moved)ReactEditor.focus(editor)
    }finally{
      endBlockDrag(editor)
    }
  }
  const sideTarget=(event:BlockDragEvent)=>{
    const state=dragging.get(editor)
    if(state?.image) {
      const rect=event.currentTarget.getBoundingClientRect()
      if(event.clientY<rect.top+8||event.clientY>rect.bottom-8)return
      if(state.node===state.image && state.group.children.slice(state.group.from+1,state.group.end).some(node=>!isEditorSpacer(node)))return
      const side=imageRowDropTarget(editor,event.currentTarget,event.clientX,event.clientY)
      return side&&canDropImage(editor,state.image,side)?side:undefined
    }
    if(!state || state.node===element || !isRowImage(state.node))return
    const from=rootCache(editor).indices.get(state.node)
    if(from===undefined || editor.children.slice(from+1,groupEnd(editor.children,from)).some(node=>!isEditorSpacer(node)) ||
      (state.lastNode!==state.node && !isEditorSpacer(state.lastNode)))return
    return imageRowDropTarget(editor,event.currentTarget,event.clientX,event.clientY)
  }
  const onDragOver=(event:BlockDragEvent)=>{
    const state=dragging.get(editor)
    if(!state)return
    event.preventDefault();event.stopPropagation()
    const side=sideTarget(event)
    const target=side?undefined:dropTarget(event)
    if(event.dataTransfer)event.dataTransfer.dropEffect=target||side?'move':'none'
    const ownerChanged=state.previewNode!==element
    const sideChanged=imageDrop?.slot!==side?.slot||imageDrop?.left!==side?.left||imageDrop?.top!==side?.top||imageDrop?.height!==side?.height
    const lineChanged=drop?.position!==target?.position||drop?.depth!==target?.depth||drop?.maxDepth!==target?.maxDepth||drop?.origin!==target?.origin||drop?.step!==target?.step||drop?.left!==target?.left||drop?.top!==target?.top
    if(!ownerChanged&&!sideChanged&&!lineChanged)return
    const update=()=>{
      if(ownerChanged){state.clearPreview?.();state.previewNode=element;state.clearPreview=()=>{setDrop(null);setImageDrop(null)}}
      if(sideChanged)setImageDrop(side??null)
      if(lineChanged)setDrop(target??null)
    }
    // Native drag events have a low cadence. Paint a changed guide on the event that finds it.
    if(event.dataTransfer&&(lineChanged||sideChanged))flushSync(update)
    else update()
  }
  handlers.current={over:onDragOver,drop:onDrop}

  return <div ref={ref} data-wysimark-block data-block-type={element.type}
    data-task-completed={taskCompleted||undefined}
    data-block-id={element.__blockId}
    data-block-foldable={foldable||undefined} data-block-collapsed={foldable&&element.__collapsed||undefined} data-block-fold-hidden={foldHidden||undefined}
    data-block-depth={depth} data-subtitle={element.__subtitle || undefined} data-block-fold-animated={animateFold||undefined}
    className={drop?.maxDepth!==undefined ? `wysimark-block drop-${drop.position}` : 'wysimark-block'}
    style={{ position: 'relative', marginLeft: isListBlock(element) ? undefined : `${depth * 2}em`,
      marginTop: element.type==='table'&&gap!=='0px'?`max(4px, calc(${gap} - var(--blo-table-top-gutter,0px)))`:gap,
      '--blo-block-anchor': `--blo-${ReactEditor.findKey(editor, element).id}`,
      '--blo-handle-indent': `${(depth-(guideLevels[guideLevels.length-1]??depth-1))*2}em`,
      '--blo-drop-left':`${drop?.left??0}px`,'--blo-drop-top':`${drop?.top??0}px` } as CSSProperties}
    data-drop-depth={drop?.depth}
    onMouseDownCapture={event => {
      imageModifierClick.current = false
      const target=event.target as HTMLElement
      if(event.button===0&&(event.shiftKey||event.ctrlKey||event.metaKey)&&target.closest(mediaContentSelector)&&!target.closest('[data-wysimark-image-resize],button,input,textarea,select')&&selectImageWithModifier(editor,index,event.shiftKey)){
        imageModifierClick.current = true
        event.preventDefault();event.stopPropagation();if(editor.selection)ReactEditor.focus(editor);return
      }
      if (!(event.target as HTMLElement).closest('.wysimark-block-handle')) clearBlockSelection(editor)
    }}
    onClickCapture={event => {
      if (!imageModifierClick.current) return
      imageModifierClick.current = false
      event.preventDefault(); event.stopPropagation()
    }}
    onMouseEnter={alignHandle} onFocusCapture={alignHandle}
    onDragEnter={onDragOver}
    onDragOver={onDragOver} onDrop={onDrop}>
    {!readOnly && <button className="wysimark-block-handle" contentEditable={false} draggable
      aria-label={ui('拖动整块及子块；点击选中并打开块菜单')}
      data-tooltip-position="bottom"
      onMouseDown={event => {
        if(event.button!==0)return
        didDrag.current = false
        const previous=dragging.get(editor)
        previous?.clearPreview?.();previous?.cleanup?.();dragging.delete(editor)
        pendingDrag.current?.clear()
        const group=selectedBlockDragGroup(editor,index)
        if(!group){pendingDrag.current=null;return}
        const highlight=highlightBlockDrag(editor,group,index),doc=event.currentTarget.ownerDocument
        const release=()=>{if(!didDrag.current){pendingDrag.current?.clear();pendingDrag.current=null}}
        pendingDrag.current={group,start:highlight.start,clear:()=>{highlight.clear();doc.removeEventListener('mouseup',release)}}
        doc.addEventListener('mouseup',release,{once:true})
      }}
      onMouseUp={() => {if(!didDrag.current){pendingDrag.current?.clear();pendingDrag.current=null}}}
      onClick={selectAndOpenMenu} onContextMenu={selectAndOpenMenu}
      onDragStart={event => {
        didDrag.current = true
        menu.current?.hide()
        const pending=pendingDrag.current
        const group=pending?.group.children===editor.children?pending.group:selectedBlockDragGroup(editor,index)
        if(!group){pending?.clear();pendingDrag.current=null;event.preventDefault();return}
        dragging.get(editor)?.clearPreview?.();dragging.get(editor)?.cleanup?.()
        if(pending?.group!==group)pending?.clear()
        const highlight=pending?.group===group?pending:highlightBlockDrag(editor,group,index)
        highlight.start()
        pendingDrag.current=null
        const stopGutter=listenToDragGutter(editor)
        dragging.set(editor, {node:editor.children[group.from],lastNode:editor.children[group.end-1],group,cleanup:()=>{highlight.clear();stopGutter()}})
        event.dataTransfer.setData('application/x-wysimark-block', String(group.from))
        event.dataTransfer.effectAllowed = 'move'
        event.stopPropagation()
      }} onDragEnd={() => { const state=dragging.get(editor);state?.clearPreview?.();state?.cleanup?.();dragging.delete(editor); setDrop(null) }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/>
        <circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/>
        <circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>
      </svg>
    </button>}
    {foldable&&<button className="wysimark-block-fold" contentEditable={false} aria-expanded={!element.__collapsed}
      aria-labelledby={foldLabelId}
      onMouseDown={event=>{event.preventDefault();event.stopPropagation()}}
      onClick={event=>{event.preventDefault();event.stopPropagation();toggleBlockFold(editor,index);if(!readOnly)ReactEditor.focus(editor)}}>
      <span id={foldLabelId} hidden>{ui(element.__collapsed?'展开子块':'折叠子块')}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 8 7-8 7z" /></svg>
    </button>}
    {imageDrop&&<span className="blo-image-drop-line" contentEditable={false} aria-hidden="true"
      style={{left:imageDrop.left,top:imageDrop.top,height:imageDrop.height}} />}
    {drop&&drop.maxDepth===undefined&&<span className="blo-image-drop-line blo-image-drop-line-horizontal" contentEditable={false} aria-hidden="true"
      style={{left:drop.left,top:drop.top}} />}
    {drop?.maxDepth!==undefined&&<span className="wysimark-drop-levels" contentEditable={false} aria-hidden="true"
      style={{left:drop.origin,top:drop.top-14,width:(drop.maxDepth+1)*drop.step}}>
      <svg width="100%" height="28" fill="none">
        <path d={`M1 14H${drop.depth*drop.step+1}`} className="wysimark-drop-level-track" strokeDasharray="2 3" />
        {Array.from({length:drop.maxDepth+1},(_,level)=><g key={level} data-drop-level={level} className={level===drop.depth?'is-active':undefined}>
          <path d={`M${level*drop.step+1} 8v14`} />
          <text x={level*drop.step+7} y="10">{level}</text>
          {level===drop.depth&&<path d={`M${level*drop.step+1} 10l5 4-5 4z`} className="wysimark-drop-level-marker" />}
        </g>)}
      </svg>
    </span>}
    <BlockHighlight element={element} />
    {children}
    {guideLevels.map(level=><span key={level} className="wysimark-list-guides" contentEditable={false} aria-hidden="true"
      style={{'--blo-guide-depth':depth,'--blo-guide-level':level,
        '--blo-guide-gap':Math.floor(previousGuides/2**level)%2===1?gap:'0px'} as CSSProperties} />)}
  </div>
}
