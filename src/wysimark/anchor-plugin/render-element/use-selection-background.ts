import { CSSProperties, useLayoutEffect, useState } from 'react'
import { Editor, Range, Text } from 'slate'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { AnchorElement } from '..'
import type { LinkSelection } from '../link-keyboard'

/** Measure only link text leaves; whole-wrapper rects would count nested marks twice. */
export function textRangeWidth(editor: Editor, range: Range): number {
  if (Range.isCollapsed(range)) return 0
  let width = 0
  for (const [, path] of Editor.nodes(editor, { at: range, match: Text.isText })) {
    const part = Range.intersection(range, Editor.range(editor, path))
    if (!part || Range.isCollapsed(part)) continue
    for (const rect of ReactEditor.toDOMRange(editor, part).getClientRects()) width += rect.width
  }
  return width
}

/** Paint on the existing inline box, whose height matches the full link background. */
export function useSelectionBackground(element: AnchorElement, selection: LinkSelection): CSSProperties | undefined {
  const editor = useSlateStatic()
  const { text: range, start, full } = selection
  const [style, setStyle] = useState<CSSProperties>()
  useLayoutEffect(() => {
    if (!range || !start || full) { setStyle(undefined); return }
    const left = textRangeWidth(editor, { anchor: start, focus: Range.start(range) })
    const right = left + textRangeWidth(editor, range)
    const backgroundImage = `linear-gradient(to right, transparent ${left}px, var(--text-selection) ${left}px, var(--text-selection) ${right}px, transparent ${right}px)`
    setStyle(previous => previous?.backgroundImage === backgroundImage ? previous : { backgroundImage })
  }, [editor, element, range, start, full])
  return style
}
