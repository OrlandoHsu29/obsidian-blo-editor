import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, DragEvent, MouseEvent, ReactNode } from 'react'
import type { Menu } from 'obsidian'
import type { Editor, Element } from 'slate'
import { ReactEditor, useReadOnly, useSlateSelector, useSlateStatic } from 'slate-react'
import { ui } from '../wysimark/utils/translations'
import { blockDepth, blockDragGroup, blockDropTarget, isEditorSpacer, isListBlock, moveBlockGroup, rootCache } from './model'
import type { BlockDragGroup } from './model'
import { useFirstLineAlignment } from './first-line-alignment'
import { blockGap } from './typography'
import { clearBlockSelection, selectBlockContents } from './selection'
import { isStructuredBlock, selectStructuredBoundary } from './boundary'
import { showBlockMenu } from './block-menu'
import { startBlockDragAutoScroll } from './drag-auto-scroll'

type DropPosition = 'before' | 'after'
type DropPreview={position:DropPosition;depth:number;maxDepth:number;origin:number;step:number;left:number;top:number}
type BlockDragEvent={currentTarget:HTMLDivElement;clientX:number;clientY:number;preventDefault:()=>void;stopPropagation:()=>void}
type DragHandlers={over:(event:BlockDragEvent)=>void;drop:(event:BlockDragEvent)=>void}
const dragHandlers=new WeakMap<HTMLElement,{current:DragHandlers|null}>()
const dragging = new WeakMap<Editor, {node:Element;group:BlockDragGroup;previewNode?:Element;clearPreview?:()=>void;cleanup?:()=>void}>()

/** Route drops in the indentation gutter to the block at the same height. */
function listenToDragGutter(editor:Editor) {
  const editable=ReactEditor.toDOMNode(editor,editor),doc=editable.ownerDocument,win=doc.defaultView!
  const blockAtPoint=(clientX:number,clientY:number)=>{
    const direct=doc.elementFromPoint(clientX,clientY)?.closest<HTMLDivElement>('[data-wysimark-block]')
    if(direct&&editable.contains(direct))return direct
    const rect=editable.getBoundingClientRect(),padding=parseFloat(win.getComputedStyle(editable).paddingRight)||0
    const x=Math.min(win.innerWidth-2,rect.right-padding-2)
    const root=doc.elementFromPoint(x,clientY)?.closest<HTMLDivElement>('[data-wysimark-block]')
    return root&&editable.contains(root)?root:undefined
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
    handler?.({currentTarget:root,clientX:event.clientX,clientY:event.clientY,
      preventDefault:()=>event.preventDefault(),stopPropagation:()=>event.stopPropagation()})
  }
  editable.addEventListener('dragover',forward);editable.addEventListener('drop',forward)
  return()=>{stopScroll();editable.removeEventListener('dragover',forward);editable.removeEventListener('drop',forward)}
}

function dropPosition(event: BlockDragEvent): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect()
  const fraction = (event.clientY - rect.top) / Math.max(1, rect.height)
  return fraction < .5 ? 'before' : 'after'
}

export function RootBlock({ element, children }: { element: Element; children: ReactNode }) {
  const editor = useSlateStatic()
  const readOnly = useReadOnly()
  // A preceding block can change without Slate re-rendering this element.
  const { index, gap } = useSlateSelector(useCallback((editor: Editor) => {
    const index = rootCache(editor).indices.get(element)
    return { index, gap: index === undefined || isEditorSpacer(element)
      ? '0px' : blockGap(editor.children, index) }
  }, [element]), (previous, next) => previous?.index === next.index && previous?.gap === next.gap)
  const depth = blockDepth(element)
  const [drop, setDrop] = useState<DropPreview | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const handlers=useRef<DragHandlers|null>(null)
  const menu = useRef<Menu | null>(null)
  const didDrag = useRef(false)
  const alignHandle = useFirstLineAlignment(ref, '--wysimark-handle-center', true,
    index !== undefined && !isEditorSpacer(element))

  useEffect(() => () => {
    menu.current?.hide()
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
      const from=rootCache(editor).indices.get(state.node)
      const group=from===undefined?undefined:blockDragGroup(editor.children,from)
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
    let anchor=index,before=target.destination===index
    if(!before) {
      anchor=target.destination-1
      while(anchor>=0) {
        if(anchor>=state.group.from&&anchor<state.group.end&&index!==state.group.from){anchor=state.group.from-1;continue}
        if(!isEditorSpacer(editor.children[anchor]))break
        anchor--
      }
    }
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
    const from = rootCache(editor).indices.get(state.node)
    if (target&&from !== undefined && moveBlockGroup(editor, from, index, dropPosition(event),target.depth)) {
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
    setDrop(previous=>previous?.position===target?.position&&previous?.depth===target?.depth&&previous?.maxDepth===target?.maxDepth&&previous?.origin===target?.origin&&previous?.step===target?.step&&previous?.left===target?.left&&previous?.top===target?.top?previous:target??null)
  }
  handlers.current={over:onDragOver,drop:onDrop}

  return <div ref={ref} data-wysimark-block data-block-type={element.type}
    data-block-depth={depth} data-subtitle={element.__subtitle || undefined}
    className={drop ? `wysimark-block drop-${drop.position}` : 'wysimark-block'}
    style={{ position: 'relative', marginLeft: isListBlock(element) ? undefined : `${depth * 2}em`,
      marginTop: gap, '--blo-block-anchor': `--blo-${ReactEditor.findKey(editor, element).id}`,
      '--blo-drop-left':`${drop?.left??0}px`,'--blo-drop-top':`${drop?.top??0}px` } as CSSProperties}
    data-drop-depth={drop?.depth}
    onMouseDownCapture={event => {
      if (!(event.target as HTMLElement).closest('.wysimark-block-handle')) clearBlockSelection(editor)
    }}
    onMouseDown={event => {
      if (readOnly || event.button !== 0 || event.shiftKey || !isStructuredBlock(element, editor)) return
      const content = ref.current?.querySelector<HTMLElement>('table,[data-wysimark-code-block],[data-blo-drawing],[data-blo-image]')
      if (!content || event.clientX < content.getBoundingClientRect().right) return
      event.preventDefault(); event.stopPropagation()
      if (selectStructuredBoundary(editor, index)) ReactEditor.focus(editor)
    }}
    onMouseEnter={alignHandle} onFocusCapture={alignHandle}
    onDragOver={onDragOver}
    onDragLeave={event => {
      if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) setDrop(null)
    }} onDrop={onDrop}>
    {!readOnly && <button className="wysimark-block-handle" contentEditable={false} draggable
      aria-label={ui('拖动整块及子块；点击选中并打开块菜单')} data-tooltip-position="right"
      onMouseDown={() => { didDrag.current = false }}
      onClick={selectAndOpenMenu} onContextMenu={selectAndOpenMenu}
      onDragStart={event => {
        didDrag.current = true
        menu.current?.hide()
        const group=blockDragGroup(editor.children,index)
        if(!group){event.preventDefault();return}
        dragging.get(editor)?.clearPreview?.();dragging.get(editor)?.cleanup?.()
        dragging.set(editor, {node:element,group,cleanup:listenToDragGutter(editor)})
        event.dataTransfer.setData('application/x-wysimark-block', String(index))
        event.dataTransfer.effectAllowed = 'move'
        event.stopPropagation()
      }} onDragEnd={() => { const state=dragging.get(editor);state?.clearPreview?.();state?.cleanup?.();dragging.delete(editor); setDrop(null) }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/>
        <circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/>
        <circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>
      </svg>
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
    {children}
  </div>
}
