import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import { Editor } from "slate"
import { indentSelectedBlocks } from '../../blocks/model'

/** Run editor shortcuts before Obsidian's global commands consume them. */
export function handleScopedHotkey(editor: Editor, event: KeyboardEvent): boolean {
  if (event.isComposing || (!event.metaKey && !event.ctrlKey)) return false
  const key = event.key.toLowerCase()
  let action: (() => void) | undefined
  if (!event.altKey && !event.shiftKey && key === 's' && editor.wysimark.save) action = () => { void editor.wysimark.save!() }
  if (event.altKey && !event.shiftKey && key === 'p' && editor.wysimark.toggleReading) action = () => { void editor.wysimark.toggleReading!() }
  if (!event.altKey && !event.shiftKey && key === 'e') action = () => editor.inlineCode.toggleInlineCode()
  if (!event.altKey && event.shiftKey && key === 'x') action = () => editor.marksPlugin.toggleStrike()
  if (!event.altKey && event.shiftKey && key === 'u') action = () => editor.blockQuotePlugin.isActive() ? editor.blockQuotePlugin.outdent() : editor.blockQuotePlugin.indent()
  if (!event.altKey && event.shiftKey && key === '7') action = () => editor.list.convertOrderedList(true)
  if (!event.altKey && event.shiftKey && key === '8') action = () => editor.list.convertUnorderedList(true)
  if (event.altKey && !event.shiftKey && key === 'h') action = () => editor.marksPlugin.toggleHighlight()
  if (event.altKey && !event.shiftKey && /^[0-5]$/.test(key)) action = () => key === '0' ? editor.collapsibleParagraph.convertParagraph() : editor.heading.convertHeading(Number(key) as 1 | 2 | 3 | 4 | 5, false)
  if (!event.altKey && !event.shiftKey && key === ']') action = () => {indentSelectedBlocks(editor,1)}
  if (!event.altKey && !event.shiftKey && key === '[') action = () => {indentSelectedBlocks(editor,-1)}
  if (action) { event.preventDefault(); event.stopPropagation(); action(); return true }
  const synthetic = {
    nativeEvent: event,
    key: event.key,
    code: event.code,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    preventDefault: () => event.preventDefault(),
    stopPropagation: () => event.stopPropagation(),
  } as ReactKeyboardEvent<HTMLDivElement>
  for (const plugin of editor.sink.plugins) {
    if (plugin.editableProps?.onKeyDown?.(synthetic)) return true
  }
  return false
}
