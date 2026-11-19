import { Editor, Element, Node, Path, Range, Transforms } from 'slate'
import type { Descendant } from 'slate'
import { ReactEditor } from 'slate-react'
import type { ImageRowElement } from '../wysimark/image-plugin/types'
import { imageRowChildren, isRowImage, rowImages } from '../wysimark/image-plugin/row-model'
import type { ImageBlockElement } from '../wysimark/image-plugin/row-model'
import { isWikiEmbedUrl, splitWikiSpec, wikiEmbedSpecFromUrl, wikiEmbedUrl } from '../wysimark/convert/obsidian-links'
import { withHistoryBatch } from '../wysimark/utils/with-history-batch'
import { isEditorSpacer } from './model'
import { selectStructuredBoundary } from './boundary'

export function activeImageRow(editor: Editor) {
  const selection = editor.selection
  if (!selection || !Range.isCollapsed(selection)) return
  const [index, child] = selection.anchor.path
  const row = editor.children[index]
  if (Element.isElement(row) && row.type === 'image-row' && row.children[child]) return { row, index, child }
}

/** Split at the real leading leaf of the right half so the caret follows it. */
export function splitImageRowAtCaret(editor: Editor): boolean {
  const active = activeImageRow(editor)
  if (!active || editor.wysimark.readOnly) return false
  const {row, index, child} = active
  if (row.children[child].type !== 'image-row-caret') return false
  withHistoryBatch(editor, () => {
    if (child === 0) {
      Transforms.insertNodes(editor, {type:'paragraph',__blockDepth:row.__blockDepth,children:[{text:''}]}, {at:[index]})
      return
    }
    const {__headingDefaults, __collapsed, ...properties} = Node.extractProps(row) as Omit<typeof row,'children'>
    editor.apply({type:'split_node',path:[index],position:child,properties:{...properties,retainLeadingCaret:true}})
    Transforms.select(editor,Editor.start(editor,[index+1,0]))
  })
  return true
}

export function imagesForRow(fragment: Descendant[]): ImageBlockElement[] | undefined {
  const images = fragment.filter(node => !isEditorSpacer(node)).flatMap<Descendant>(node => Element.isElement(node) && node.type === 'image-row' ? rowImages(node) : [node])
  if (images.length && images.every(isRowImage)) return images
}

export type ImageRowTarget = { index: number; slot: number }

export function canDropImage(editor: Editor, image: Element, target: ImageRowTarget): boolean {
  try {
    const path = ReactEditor.findPath(editor, image)
    return Node.has(editor,path) && Node.get(editor,path) === image && (path[0] !== target.index ||
      path.length === 2 && target.slot !== Math.floor(path[1] / 2) && target.slot !== Math.floor(path[1] / 2) + 1)
  } catch { return false }
}

export function imageRowTargetFromEvent(editor: Editor, event: DragEvent) {
  const target = event.target as HTMLElement | null
  const editable = ReactEditor.toDOMNode(editor, editor)
  const viewport = editable.getBoundingClientRect()
  const win = editable.ownerDocument.defaultView!
  const root = target?.closest?.<HTMLElement>('[data-wysimark-block]')
    ?? editable.ownerDocument.elementFromPoint(
      Math.min(win.innerWidth - 2, viewport.right - (parseFloat(win.getComputedStyle(editable).paddingRight) || 0) - 2),
      event.clientY,
    )?.closest<HTMLElement>('[data-wysimark-block]')
  if (!root || !editable.contains(root)) return
  const placement = imageRowDropTarget(editor, root, event.clientX, event.clientY)
  if (placement) return { root, placement }
}

export function imageRowAtBoundary(editor: Editor, index: number): ImageRowTarget | undefined {
  const node = editor.children[index]
  if (isRowImage(node)) return { index, slot: 1 }
  if (Element.isElement(node) && node.type === 'image-row') return { index, slot: rowImages(node).length }
}

function rowChild(image: ImageBlockElement): ImageBlockElement {
  const { __blockId, __blockDepth, __headingDefaults, __collapsed, ...child } = image
  if (isWikiEmbedUrl(child.url)) {
    const {target, display} = splitWikiSpec(wikiEmbedSpecFromUrl(child.url))
    if (display && /^\d+(?:x\d+)?$/.test(display)) child.url = wikiEmbedUrl(target)
  }
  return child
}

function imageSize(editor: Editor, image: ImageBlockElement) {
  try {
    const img = ReactEditor.toDOMNode(editor,image).querySelector<HTMLImageElement>('[data-blo-image] > img')
    if (img?.naturalWidth && img.naturalHeight && img.offsetWidth && img.offsetHeight) {
      return { width:img.offsetWidth, height:img.offsetHeight, srcWidth:img.naturalWidth, srcHeight:img.naturalHeight }
    }
  } catch { /* A clipboard image may not have a rendered element yet. */ }
  return { width:image.width, height:image.height, srcWidth:image.srcWidth, srcHeight:image.srcHeight }
}

/** Keep the displayed sizes when taking an image out of a fitted row. */
export function preserveImageRowSizesOnRemoval(editor: Editor, path: Path, remove: () => void) {
  const row = editor.children[path[0]]
  if (path.length !== 2 || !Element.isElement(row) || row.type !== 'image-row' || row.children[path[1]]?.type !== 'image-block') return remove()
  Editor.withoutNormalizing(editor, () => {
    row.children.forEach((image, index) => {
      if (index === path[1] || image.type !== 'image-block') return
      const size = imageSize(editor,image)
      if (size.width !== image.width || size.height !== image.height) {
        Transforms.setNodes(editor,size,{at:[path[0],index]})
      }
    })
    remove()
  })
}

export function moveImageToBlock(editor: Editor, source: Path, destination: number, depth: number): boolean {
  const image = Node.getIf(editor, source)
  if (editor.wysimark.readOnly || source.length !== 2 || !isRowImage(image)) return false
  const dimensions = imageSize(editor,image)
  withHistoryBatch(editor, () => {
    Transforms.removeNodes(editor,{at:source})
    Transforms.removeNodes(editor,{at:[source[0],source[1]-1]})
    Transforms.insertNodes(editor,{...image,...dimensions,__blockDepth:depth},{at:[destination]})
    Transforms.select(editor,Editor.start(editor,[destination]))
  })
  return true
}

/** Preserve the target's block metadata and leave its real boundary caret in place. */
export function insertImageRow(editor: Editor, target: ImageRowTarget, images: ImageBlockElement[], source?: Path): boolean {
  const node = editor.children[target.index]
  if (editor.wysimark.readOnly || !images.length || !images.every(isRowImage) || !imageRowAtBoundary(editor, target.index)) return false
  if (!Element.isElement(node) || (node.type !== 'image-block' && node.type !== 'image-row')) return false
  if (source && (Path.equals(source, [target.index]) || !Node.has(editor, source))) return false
  const children = node.type === 'image-row' ? rowImages(node) : [node]
  const slot = Math.max(0, Math.min(children.length, target.slot))
  if (node.type === 'image-row' && source?.length === 2 && source[0] === target.index) {
    const image = source[1], gap = image - 1, destination = slot * 2
    if (node.children[image]?.type !== 'image-block' || destination === gap || destination === gap + 2) return false
    // Move the image with its leading caret to preserve both Slate nodes and their display sizes.
    const move = (from: number, to: number) => Transforms.moveNodes(editor, { at: [target.index,from], to: [target.index,to] })
    withHistoryBatch(editor, () => {
      if (destination < gap) {
        move(gap,destination)
        move(image,destination+1)
      } else {
        move(image,destination-1)
        move(gap,destination-2)
      }
      selectStructuredBoundary(editor,target.index)
    })
    return true
  }
  const caret = activeImageRow(editor)
  const pasteInGap = !source && caret?.index === target.index && caret.child === slot * 2
  const sized: ImageBlockElement[] = children.map(image => ({ ...rowChild(image), ...imageSize(editor,image) }))
  const anchorHeight = Math.max(0, ...sized.map(image => image.height || 0))
  sized.splice(slot, 0, ...images.map(image => {
    const child = rowChild(image)
    if (!anchorHeight) return child
    const {width,height,srcWidth,srcHeight} = imageSize(editor,image)
    const aspect = srcWidth && srcHeight ? srcWidth / srcHeight : width && height ? width / height : undefined
    return { ...child, srcWidth, srcHeight, height:anchorHeight, width:aspect ? Math.max(1,Math.round(anchorHeight * aspect)) : undefined }
  }))
  const { __blockId, __blockDepth, __headingDefaults, __collapsed } = node
  const row: ImageRowElement = { type: 'image-row', children: imageRowChildren(sized) }
  const metadata = { __blockId, __blockDepth, __headingDefaults, __collapsed }
  for (const key of Object.keys(metadata) as (keyof typeof metadata)[]) {
    if (metadata[key] !== undefined) Object.assign(row, { [key]: metadata[key] })
  }
  withHistoryBatch(editor, () => {
    // Replace the target first and track its path while removing the source.
    Transforms.removeNodes(editor, { at: [target.index] })
    Transforms.insertNodes(editor, row, { at: [target.index] })
    const ref = Editor.pathRef(editor, [target.index])
    try {
      if (source) {
        Transforms.removeNodes(editor, { at: source })
        if (source.length === 1 && isEditorSpacer(editor.children[source[0]])) Transforms.removeNodes(editor, { at: source })
      }
      if (ref.current) {
        const next = ref.current[0] + 1
        if (!isEditorSpacer(editor.children[next])) Transforms.insertNodes(editor, {type:'paragraph',__collapsible:true,children:[{text:''}]}, {at:[next]})
        const afterImages = slot + images.length
        const destination = pasteInGap && afterImages < sized.length ? [ref.current[0], afterImages * 2] : [next]
        Transforms.select(editor, Editor.start(editor, destination))
      }
      editor.marks = null
    } finally { ref.unref() }
  })
  return true
}

export function imageRowDropTarget(editor: Editor, root: HTMLElement, x: number, y: number) {
  const group = root.querySelector('[data-blo-image-row-track]')
  const items = group ? Array.from(group.children).filter(item => item.hasAttribute('data-blo-image-item')) : [root]
  const pictures = items.map(item => item.querySelector<HTMLElement>('[data-blo-image] > img'))
  if (!pictures.length || pictures.some(picture => !picture)) return
  const rects = pictures.map(picture => picture!.getBoundingClientRect())
  const top = Math.min(...rects.map(rect => rect.top)), bottom = Math.max(...rects.map(rect => rect.bottom))
  if (y < top || y > bottom) return
  // Use horizontal side zones, even when the fitted images leave no gap.
  const slot = rects.findIndex(rect => x < (rect.left + rect.right) / 2)
  const at = slot === -1 ? rects.length : slot
  const before = rects[at], after = rects[at - 1]
  const nearBefore = before && x <= before.left + before.width * .35
  const nearAfter = after && x >= after.right - after.width * .35
  if (!nearBefore && !nearAfter) return
  const element = root.querySelector('[data-blo-image-row],[data-blo-image-item]')
  const bounds = root.getBoundingClientRect()
  const editorBounds = root.closest('[data-slate-editor="true"]')?.getBoundingClientRect() ?? bounds
  const scale = bounds.width / root.offsetWidth || 1
  if (!element || x < editorBounds.left || x > editorBounds.right) return
  try {
    const path = ReactEditor.findPath(editor, ReactEditor.toSlateNode(editor, element))
    if (path.length !== 1 || !imageRowAtBoundary(editor, path[0])) return
    const edge = before && after ? (before.left + after.right) / 2 : before ? before.left - 3 : after.right + 3
    return { index: path[0], slot: at, left: (edge - bounds.left) / scale, top: (top - bounds.top) / scale, height: (bottom - top) / scale }
  } catch { return }
}
