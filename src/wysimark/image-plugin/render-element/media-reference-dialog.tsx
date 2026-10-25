import { useEffect, useRef, useState } from 'react'
import type { FunctionComponent } from 'react'
import { Editor, Range, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor, useReadOnly, useSelected, useSlateStatic } from 'slate-react'
import { AnchorDialog } from '../../anchor-plugin/render-element/AnchorDialog'
import { $Input, $PrimaryButton, $CancelButton } from '../../shared-styles'
import { $Panel } from '../../shared-overlays'
import { positionInside, useAbsoluteReposition } from '../../use-reposition'
import { useLayer } from '../../use-layer'
import { ui } from '../../utils/translations'
import type { ImageBlockElement, ImageInlineElement } from '../types'
import { deleteBlockGroup } from '../../../blocks/model'

function EditMediaReference({ anchor, target, onSave }: { anchor: HTMLElement; target: string; onSave: (target: string) => void }) {
  const ref = useRef<HTMLDivElement>(null), [value, setValue] = useState(target)
  const dialog = useLayer('dialog')
  const style = useAbsoluteReposition({ src: ref, destAnchor: anchor, destStartEdge: anchor },
    ({ src, destAnchor }, viewport) => positionInside(src, viewport, { left: destAnchor.left, top: destAnchor.top + destAnchor.height }, { margin: 16 }))
  return <$Panel ref={ref} contentEditable={false} style={{ ...style, position: 'absolute', width: '20em', padding: '1em', zIndex: 1000 }}>
    <form onSubmit={event => { event.preventDefault(); if (value.trim()) onSave(value.trim()) }}>
      <$Input aria-label={ui('引用文件')} value={value} onChange={event => setValue(event.target.value)} autoFocus />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <$CancelButton as="button" onClick={event => { event.preventDefault(); dialog.close() }}>{ui('取消')}</$CancelButton>
        <$PrimaryButton as="button">{ui('修改引用')}</$PrimaryButton>
      </div>
    </form>
  </$Panel>
}

/** Information about a vault source outside the managed attachment directory. */
export function MediaReferenceDialog({ element }: { element: ImageBlockElement | ImageInlineElement }) {
  const editor = useSlateStatic(), selected = useSelected(), readOnly = useReadOnly()
  const dialog = useLayer('dialog'), dialogRef = useRef(dialog), elementRef = useRef(element)
  dialogRef.current = dialog; elementRef.current = element
  const owned = useRef<FunctionComponent<Record<string, never>> | null>(null)
  useEffect(() => {
    if (!selected || readOnly || !editor.selection || !Range.isCollapsed(editor.selection)) return
    const file = editor.wysimark.getReferencedMedia?.(element.url)
    if (!file) return
    const doc = ReactEditor.toDOMNode(editor, element).ownerDocument
    const timer = doc.defaultView!.setTimeout(() => {
      const root = ReactEditor.toDOMNode(editor, elementRef.current)
      const anchor = root.querySelector<HTMLElement>('[data-blo-drawing],[data-blo-image]') || root
      const card = () => <AnchorDialog destAnchor={anchor} destStartEdge={anchor} embed={{
        target: file.target, file,
        onRemove: () => {
          if (editor.wysimark.readOnly) return
          const at=ReactEditor.findPath(editor,elementRef.current)
          if(at.length===1)deleteBlockGroup(editor,at[0])
          else Transforms.removeNodes(editor,{at})
        },
        onEdit: () => dialogRef.current.open(() => <EditMediaReference anchor={anchor} target={file.target} onSave={target => {
          if (editor.wysimark.readOnly) return
          const url = editor.wysimark.resolveInternalMedia?.(target)
          if (!url) return
          const at = ReactEditor.findPath(editor, elementRef.current)
          const update = () => Editor.withoutNormalizing(editor, () => {
            Transforms.unsetNodes(editor, ['width', 'height', 'srcWidth', 'srcHeight'], { at })
            Transforms.setNodes(editor, { url }, { at })
          })
          if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, update)
          else update()
          dialogRef.current.close()
        }} />),
      }} />
      owned.current = card; dialogRef.current.open(card)
    })
    return () => {
      doc.defaultView!.clearTimeout(timer)
      if (dialogRef.current.layer?.Component === owned.current) dialogRef.current.close()
    }
  }, [selected, readOnly, element.url])
  return null
}
