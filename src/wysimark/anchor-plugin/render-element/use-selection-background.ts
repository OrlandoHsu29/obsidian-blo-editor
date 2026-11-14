import { CSSProperties, useCallback, useLayoutEffect, useState } from 'react'
import { Editor, Range, Text } from 'slate'
import { ReactEditor, useSlateSelector, useSlateStatic } from 'slate-react'
import { AnchorElement } from '..'


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
export function useSelectionBackground(element: AnchorElement, full: boolean): CSSProperties | undefined {
  const editor = useSlateStatic()
  const range = useSlateSelector(useCallback(editor => {
    if (!editor.selection || Range.isCollapsed(editor.selection)) return null
    try {
      const range = Range.intersection(editor.selection, Editor.range(editor, ReactEditor.findPath(editor, element)))
      return range && Range.isExpanded(range) ? range : null
    } catch { return null }
  }, [element]), (a, b) => a === b || !!a && !!b && Range.equals(a, b))
  const [style, setStyle] = useState<CSSProperties>()
  useLayoutEffect(() => {
    if (!range || full) { setStyle(undefined); return }
    const start = Editor.start(editor, ReactEditor.findPath(editor, element))
    const left = textRangeWidth(editor, { anchor: start, focus: Range.start(range) })
    const right = left + textRangeWidth(editor, range)
    const backgroundImage = `linear-gradient(to right, transparent ${left}px, var(--text-selection) ${left}px, var(--text-selection) ${right}px, transparent ${right}px)`
    setStyle({ backgroundImage })
  }, [editor, element, range, full])
  return style
}
