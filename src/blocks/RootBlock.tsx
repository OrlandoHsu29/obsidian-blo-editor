import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import type { Menu } from 'obsidian'
import type { Editor, Element, Node } from 'slate'
import { ReactEditor, useReadOnly, useSlateSelector, useSlateStatic } from 'slate-react'
import { ui } from '../wysimark/utils/translations'
import { blockDepth, blockDragGroup, blockDropTarget, isEditorSpacer, isListBlock, moveBlockGroup, rootCache, selectedBlockDragGroup } from './model'
import type { BlockDragGroup } from './model'
import { useFirstLineAlignment } from './first-line-alignment'
import { blockGap } from './typography'
import { clearBlockSelection, selectBlockContents } from './selection'
import { showBlockMenu } from './block-menu'
import { startBlockDragAutoScroll } from './drag-auto-scroll'
import { BlockHighlight, highlightBlockDrag } from './block-highlight'
import { toggleBlockFold } from './folding'

type DropPosition = 'before' | 'after'
type DropPreview={position:DropPosition;depth:number;maxDepth:number;origin:number;step:number;left:number;top:number}
type BlockDragEvent={currentTarget:HTMLDivElement;clientX:number;clientY:number;dataTransfer?:DataTransfer|null;preventDefault:()=>void;stopPropagation:()=>void}
type DragHandlers={over:(event:BlockDragEvent)=>void;drop:(event:BlockDragEvent)=>void}
const dragHandlers=new WeakMap<HTMLElement,{current:DragHandlers|null}>()
const dragging = new WeakMap<Editor, {node:Node;lastNode:Node;group:BlockDragGroup;previewNode?:Element;clearPreview?:()=>void;cleanup?:()=>void}>()

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

export function RootBlock({ element, children }: { element: Element; children: ReactNode }) {
  const editor = useSlateStatic()
  const readOnly = useReadOnly()
  const foldLabelId = useId()
  // A preceding block can change without Slate re-rendering this element.
  const { index, gap, guideMask, previousGuides, foldable, foldHidden } = useSlateSelector(useCallback((editor: Editor) => {
    const cache=rootCache(editor),index = cache.indices.get(element)
    const previous=cache.previousVisible.get(element)??-1,prior=editor.children[previous],foldHidden=cache.foldedBy.has(element)
    return { index,foldHidden,foldable:cache.foldable.has(element),guideMask:foldHidden?0:cache.listGuides.get(element)??0,previousGuides:prior?cache.listGuides.get(prior)??0:0,
      gap:index===undefined||isEditorSpacer(element)||foldHidden?'0px':blockGap(editor.children,index,previous) }
  }, [element]), (previous, next) => previous?.index === next.index && previous?.gap === next.gap && previous?.guideMask === next.guideMask && previous?.previousGuides === next.previousGuides && previous?.foldable === next.foldable && previous?.foldHidden === next.foldHidden)
  const depth = blockDepth(element)
  const guideLevels=guideMask?Array.from({length:depth},(_,level)=>level).filter(level=>Math.floor(guideMask/2**level)%2===1):[]
  const [drop, setDrop] = useState<DropPreview | null>(null)
  const ref = useRef<HTMLDivElement>(null)
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
  if (index === undefined || isEditorSpacer(element)) return <>{children}</>

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
      const group=from===undefined||last===undefined?undefined:blockDragGroup(editor.children,from,last+1)
      if(!group)return
      state.group=group
    }
    const rect=event.currentTarget.getBoundingClientRect(),style=getComputedStyle(event.currentTarget)
    const scale=event.currentTarget.offsetWidth?rect.width/event.currentTarget.offsetWidth:1
    const unit=2*parseFloat(style.fontSize)*(scale||1)
    const origin=rect.left-(isListBlock(element)?0:depth*unit)
    const position=dropPosition(event)
    const target=blockDropTarget(state.group,index,position,(event.clientX-origin)/unit)
    if(!target)return
    const cache=rootCache(editor)
    let anchor=target.previous,before=anchor<0
    if(before){anchor=target.destination;while(anchor<editor.children.length&&(isEditorSpacer(editor.children[anchor])||anchor>=state.group.from&&anchor<state.group.end))anchor++;if(anchor>=editor.children.length)anchor=state.group.from}
    const owner=cache.foldedBy.get(editor.children[anchor])
    if(owner)anchor=cache.indices.get(owner)!
    const anchorDOM=anchor===index?event.currentTarget:ReactEditor.toDOMNode(editor,editor.children[anchor]).closest<HTMLElement>('[data-wysimark-block]')
    if(!anchorDOM)return
    const bounds=anchorDOM.getBoundingClientRect()
    return {position:before?'before' as const:'after' as const,depth:target.depth,maxDepth:target.maxDepth,
      origin:(origin-rect.left)/(scale||1),step:unit/(scale||1),
      left:(origin+target.depth*unit-rect.left)/(scale||1),top:((before?bounds.top:bounds.bottom)-rect.top)/(scale||1)}
  }

  const onDrop = (event: BlockDragEvent) => {
    const state = dragging.get(editor)
    if (!state) return
    event.preventDefault()
    event.stopPropagation()
    const target=dropTarget(event)
    if(event.dataTransfer)event.dataTransfer.dropEffect=target?'move':'none'
    const from = rootCache(editor).indices.get(state.node)
    if (target&&from !== undefined && moveBlockGroup(editor, from, index, dropPosition(event),target.depth,state.group.end)) {
      ReactEditor.focus(editor)
    }
    state.clearPreview?.()
    state.cleanup?.()
    dragging.delete(editor)
    setDrop(null)
  }
  const onDragOver=(event:BlockDragEvent)=>{
    const state=dragging.get(editor)
    if(!state)return
    event.preventDefault();event.stopPropagation()
    if(state.previewNode!==element){state.clearPreview?.();state.previewNode=element;state.clearPreview=()=>setDrop(null)}
    const target=dropTarget(event)
    if(event.dataTransfer)event.dataTransfer.dropEffect=target?'move':'none'
    setDrop(previous=>previous?.position===target?.position&&previous?.depth===target?.depth&&previous?.maxDepth===target?.maxDepth&&previous?.origin===target?.origin&&previous?.step===target?.step&&previous?.left===target?.left&&previous?.top===target?.top?previous:target??null)
  }
  handlers.current={over:onDragOver,drop:onDrop}

  return <div ref={ref} data-wysimark-block data-block-type={element.type}
    data-block-id={element.__blockId}
    data-block-foldable={foldable||undefined} data-block-collapsed={foldable&&element.__collapsed||undefined} data-block-fold-hidden={foldHidden||undefined}
    data-block-depth={depth} data-subtitle={element.__subtitle || undefined} data-block-fold-animated={animateFold||undefined}
    className={drop ? `wysimark-block drop-${drop.position}` : 'wysimark-block'}
    style={{ position: 'relative', marginLeft: isListBlock(element) ? undefined : `${depth * 2}em`,
      marginTop: element.type==='table'&&gap!=='0px'?`max(4px, calc(${gap} - var(--blo-table-top-gutter,0px)))`:gap,
      '--blo-block-anchor': `--blo-${ReactEditor.findKey(editor, element).id}`,
      '--blo-handle-indent': `${(depth-(guideLevels[guideLevels.length-1]??depth-1))*2}em`,
      '--blo-drop-left':`${drop?.left??0}px`,'--blo-drop-top':`${drop?.top??0}px` } as CSSProperties}
    data-drop-depth={drop?.depth}
    onMouseDownCapture={event => {
      if (!(event.target as HTMLElement).closest('.wysimark-block-handle')) clearBlockSelection(editor)
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
    {drop&&<span className="wysimark-drop-levels" contentEditable={false} aria-hidden="true"
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
    <BlockHighlight element={element} rootRef={ref} />
    {children}
    {guideLevels.map(level=><span key={level} className="wysimark-list-guides" contentEditable={false} aria-hidden="true"
      style={{'--blo-guide-depth':depth,'--blo-guide-level':level,
        '--blo-guide-gap':Math.floor(previousGuides/2**level)%2===1?gap:'0px'} as CSSProperties} />)}
  </div>
}
