import { FileSystemAdapter, htmlToMarkdown, Notice } from 'obsidian'
import { Editor, Node, Range } from 'slate'
import { ReactEditor } from 'slate-react'
import { aiQuoteLocation, aiQuoteMarkdown, aiQuotePrompt } from './ai-quote-markdown'
import { ui } from './wysimark/utils/translations'

export function prepareAiQuote(editor: Editor, host: HTMLElement, adapter: FileSystemAdapter, path: string) {
  const selection = host.ownerDocument.getSelection()
  if (!selection?.anchorNode || !selection.focusNode || !host.contains(selection.anchorNode) ||
    !host.contains(selection.focusNode)) return
  const range = ReactEditor.toSlateRange(editor, selection, { exactMatch: false, suppressThrow: true })
  if (!range || Range.isCollapsed(range)) return
  const fragment = editor.selection && Range.equals(range, editor.selection)
    ? editor.getFragment() : Node.fragment(editor, range)
  const location = aiQuoteLocation(editor, range)
  return () => {
    try {
      const markdown = aiQuoteMarkdown(fragment, htmlToMarkdown)
      if (!markdown) {
        new Notice(ui('所选内容没有可引用的 Markdown'))
        return
      }
      const { clipboard } = require('electron')
      clipboard.writeText(aiQuotePrompt(adapter.getFullPath(path), location, markdown))
      new Notice(ui('AI 引用已复制'))
    } catch (error) {
      console.error('Blo Editor: could not copy the selected passage', error)
      new Notice(ui('无法复制 AI 引用'))
    }
  }
}
