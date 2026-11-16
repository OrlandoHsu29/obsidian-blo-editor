import { ui } from "../../../utils/translations"
import { useEffect, useId, useRef, useState } from 'react'
import { Editor, Transforms } from 'slate'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { $Panel, CloseMask } from '../../../shared-overlays'
import { useAnchoredPanelPosition } from '../../../use-reposition/hooks/use-block-toolbar-position'
import { DEFAULT_TEXT_COLOR } from '../../../marks-plugin/methods/text-color'
import { TEXT_COLORS } from '../../../../blocks/colors'
import { isDomElement } from '../../../../dom-guards'
import { DEFAULT_HIGHLIGHT_COLOR, HIGHLIGHT_COLORS, highlightBackground } from '../../../marks-plugin/methods/highlight-color'

export function TextColorMenu({dest, close, highlight = false}: {dest: HTMLElement; close: () => void; highlight?: boolean}) {
  const labelId=useId()
  const editor = useSlateStatic(), ref = useRef<HTMLDivElement>(null)
  const [selection] = useState(() => editor.selection ? Editor.rangeRef(editor, editor.selection) : null)
  const current = highlight ? editor.wysimark.getHighlightColor?.() ?? DEFAULT_HIGHLIGHT_COLOR
    : editor.wysimark.getTextColor ? editor.wysimark.getTextColor() : DEFAULT_TEXT_COLOR
  const style = useAnchoredPanelPosition(dest, ref, { close })
  useEffect(() => () => { selection?.unref() }, [selection])
  useEffect(() => {
    const doc = dest.ownerDocument ?? document
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); ReactEditor.focus(editor) }
    }
    doc.addEventListener('keydown', onKey, true)
    return () => doc.removeEventListener('keydown', onKey, true)
  }, [close, editor, dest])
  const apply = (color: string | null) => {
    if (selection?.current) Transforms.select(editor, selection.current)
    if (highlight) editor.wysimark.setHighlightColor?.(color)
    else editor.wysimark.setTextColor?.(color)
    close(); ReactEditor.focus(editor)
  }
  const colors = [[ui("红色"),DEFAULT_TEXT_COLOR],[ui("橙色"),TEXT_COLORS.orange],[ui("黄色"),TEXT_COLORS.yellow],[ui("绿色"),TEXT_COLORS.green],[ui("蓝色"),TEXT_COLORS.blue],[ui("紫色"),TEXT_COLORS.purple],[ui("灰色"),TEXT_COLORS.gray]]
  const check=<svg className="wysimark-color-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>
  return <>
    <CloseMask close={close} isInside={target => dest.contains(target)} />
    <$Panel ref={ref} style={style} className="wysimark-text-color-menu" role="dialog" aria-labelledby={labelId} onMouseDown={event => {
      if (!(isDomElement(event.target) && event.target.tagName === 'INPUT')) event.preventDefault()
    }}>
      <span id={labelId} hidden>{highlight ? ui('高亮') : ui("字体颜色")}</span>
      <div className="wysimark-color-palette" role="group" aria-labelledby={labelId+'-group'}>
        <span id={labelId+'-group'} hidden>{ui("颜色")}</span>
        {!highlight && <>
          <button aria-label={ui("系统颜色")} data-tooltip-position="bottom" data-text-color="system" aria-pressed={current === null} style={{'--swatch-color':'var(--text-normal)'} as React.CSSProperties} onClick={() => apply(null)}>{check}</button>
          <span className="wysimark-color-separator" role="separator" aria-orientation="vertical" />
        </>}
        {(highlight ? [[ui('黄色'),DEFAULT_HIGHLIGHT_COLOR],...colors.filter(([,color])=>HIGHLIGHT_COLORS.includes(color))] : colors).map(([name,color]) => <button key={color} aria-label={name} data-tooltip-position="bottom" data-text-color={color} aria-pressed={current?.toUpperCase() === color} style={{'--swatch-color':highlight ? highlightBackground(color) : color} as React.CSSProperties} onClick={() => apply(color)}>{check}</button>)}
      </div>
    </$Panel>
  </>
}

export function HighlightColorMenu(props: { dest: HTMLElement; close: () => void }) {
  return <TextColorMenu {...props} highlight />
}
