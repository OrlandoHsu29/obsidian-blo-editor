import { Platform } from 'obsidian'
import type { Hotkey, Plugin } from 'obsidian'
import type { Editor } from 'slate'
import { ReactEditor } from 'slate-react'
import { HistoryEditor } from 'slate-history'
import { indentSelectedBlocks } from './blocks/model'
import { t, ui } from './wysimark/utils/translations'

type EditorCommand = { id: string; name: string; hotkeys: Hotkey[]; run?: (editor: Editor) => void; readOnly?: boolean }
const key = (key: string, ...modifiers: Hotkey['modifiers']): Hotkey[] => [{ key, modifiers }]
/** One catalog supplies registered commands, editor dispatch and displayed shortcuts. */
export function editorCommands(): EditorCommand[] {
  return [
    { id: 'toggle-bold', name: t('bold'), hotkeys: key('b', 'Mod'), run: e => e.marksPlugin.toggleBold() },
    { id: 'toggle-italic', name: t('italic'), hotkeys: key('i', 'Mod'), run: e => e.marksPlugin.toggleItalic() },
    { id: 'toggle-underline', name: t('underline'), hotkeys: key('u', 'Mod'), run: e => e.marksPlugin.toggleUnderline() },
    { id: 'toggle-strikethrough', name: t('strike'), hotkeys: key('x', 'Mod', 'Shift'), run: e => e.marksPlugin.toggleStrike() },
    { id: 'toggle-inline-code', name: t('inlineCode'), hotkeys: key('e', 'Mod'), run: e => e.inlineCode.toggleInlineCode() },
    { id: 'toggle-highlight', name: ui('高亮'), hotkeys: key('h', 'Mod', 'Alt'), run: e => e.marksPlugin.toggleHighlight() },
    { id: 'paragraph', name: t('normal'), hotkeys: key('0', 'Mod', 'Alt'), run: e => e.collapsibleParagraph.convertParagraph() },
    ...([1, 2, 3, 4, 5] as const).map(level => ({ id: `heading-${level}`, name: t(`heading${level}`), hotkeys: key(String(level), 'Mod', 'Alt'), run: (e: Editor) => { e.heading.convertHeading(level, true) } })),
    { id: 'toggle-ordered-list', name: t('numberedList'), hotkeys: key('7', 'Mod', 'Shift'), run: e => e.list.convertOrderedList(true) },
    { id: 'toggle-unordered-list', name: t('bulletList'), hotkeys: key('8', 'Mod', 'Shift'), run: e => e.list.convertUnorderedList(true) },
    { id: 'toggle-task-list', name: t('checkList'), hotkeys: key('9', 'Mod', 'Shift'), run: e => e.list.convertTaskList(true) },
    { id: 'toggle-quote', name: ui('引用'), hotkeys: key('u', 'Mod', 'Shift'), run: e => e.blockQuotePlugin.isActive() ? e.blockQuotePlugin.outdent() : e.blockQuotePlugin.indent() },
    { id: 'indent-block', name: t('increaseDepth'), hotkeys: key(']', 'Mod'), run: e => { indentSelectedBlocks(e, 1) } },
    { id: 'outdent-block', name: t('decreaseDepth'), hotkeys: key('[', 'Mod'), run: e => { indentSelectedBlocks(e, -1) } },
    { id: 'insert-link', name: t('insertLink'), hotkeys: key('k', 'Mod'), run: e => e.wysimark.openLink?.() },
    ...(['insertTable', 'insertAttachment', 'codeBlock', 'horizontalRule'] as const).map((title, index) => ({
      id: ['insert-table', 'insert-attachment', 'insert-code-block', 'insert-horizontal-rule'][index],
      name: t(title), hotkeys: [], run: (e: Editor) => e.wysimark.openToolbarTool?.(t(title)),
    })),
    { id: 'undo', name: ui('撤销'), hotkeys: key('z', 'Mod'), run: e => { if (HistoryEditor.isHistoryEditor(e)) e.undo() } },
    { id: 'redo', name: ui('重做'), hotkeys: [...key('z', 'Mod', 'Shift'), ...key('y', 'Mod')], run: e => { if (HistoryEditor.isHistoryEditor(e)) e.redo() } },
    { id: 'save-note', name: ui('保存笔记'), hotkeys: key('s', 'Mod'), run: e => { void e.wysimark.save?.() }, readOnly: true },
    // Existing IDs preserve users' bindings and their command-palette behavior.
    { id: 'find-text', name: ui('查找当前文档'), hotkeys: key('f', 'Mod'), readOnly: true },
    { id: 'replace-text', name: ui('替换当前文档'), hotkeys: key('h', 'Mod') },
    { id: 'toggle-reading', name: ui('切换富文本编辑与阅读'), hotkeys: key('p', 'Mod', 'Alt'), readOnly: true },
    { id: 'text-color', name: ui('应用上次字体颜色'), hotkeys: key('c', 'Mod', 'Alt') },
    { id: 'insert-inline-math', name: ui('插入行内公式'), hotkeys: key('m', 'Mod', 'Shift') },
    { id: 'clear-formatting', name: ui('清除文字样式'), hotkeys: [] },
    { id: 'insert-drawing', name: ui('插入画板'), hotkeys: [] },
  ]
}

export function matchesHotkey(event: KeyboardEvent, hotkey: Hotkey, mac = Platform.isMacOS): boolean {
  const modifiers = new Set(hotkey.modifiers.map(m => m === 'Mod' ? mac ? 'Meta' : 'Ctrl' : m))
  const physical = /^Key([A-Z])$/.exec(event.code)?.[1] ?? /^Digit([0-9])$/.exec(event.code)?.[1]
  return (event.key.toLowerCase() === hotkey.key.toLowerCase() || physical?.toLowerCase() === hotkey.key.toLowerCase()) &&
    !!event.ctrlKey === modifiers.has('Ctrl') && !!event.metaKey === modifiers.has('Meta') &&
    !!event.altKey === modifiers.has('Alt') && !!event.shiftKey === modifiers.has('Shift')
}

type HotkeyHost = { getHotkeys(id: string): Hotkey[] | undefined; getDefaultHotkeys(id: string): Hotkey[] | undefined; printHotkeyForCommand(id: string): string }
export function installEditorHotkeys(plugin: Plugin, getEditor: () => Editor | undefined) {
  const commands = editorCommands(), manager = (plugin.app as unknown as { hotkeyManager: HotkeyHost }).hotkeyManager
  for (const command of commands.filter(c => c.run)) plugin.addCommand({ id: command.id, name: command.name, hotkeys: command.hotkeys, checkCallback: checking => {
    const editor = getEditor()
    if (!editor || editor.wysimark.readOnly && !command.readOnly) return false
    if (!checking) { if (!command.readOnly) ReactEditor.focus(editor); command.run!(editor) }
    return true
  } })
  const effective = (id: string) => manager.getHotkeys(id) ?? manager.getDefaultHotkeys(id) ?? []
  // Upstream aliases are retired in hosted Blo views, so removing/rebinding a
  // command cannot fall through to an old Slate or Wysimark format shortcut.
  const legacy = [key('j', 'Mod'), ...['0','1','2','3','4','5','7','8','9','k','.',','].map(k => key(k, 'Mod', Platform.isMacOS ? 'Alt' : 'Shift'))].flat()
  const retiredBindings = [...commands.flatMap(c => c.hotkeys), ...legacy]
  const aliases: Record<string, string> = { [ui('清除格式')]: 'clear-formatting', [ui('字体颜色')]: 'text-color' }
  return {
    handle(editor: Editor, event: KeyboardEvent): boolean {
      if (event.isComposing) return false
      const command = commands.find(c => effective(`${plugin.manifest.id}:${c.id}`).some(k => matchesHotkey(event, k)))
      const retired = !command && retiredBindings.some(k => matchesHotkey(event, k))
      if (!command && !retired) return false
      event.preventDefault(); event.stopPropagation()
      if (command && (!editor.wysimark.readOnly || command.readOnly)) {
        if (command.run) command.run(editor)
        else (plugin.app as any).commands.executeCommandById(`${plugin.manifest.id}:${command.id}`)
      }
      return true
    },
    label(title: string, fallback?: string): string | undefined {
      const command = commands.find(c => c.name === title || c.id === aliases[title])
      return command ? manager.printHotkeyForCommand(`${plugin.manifest.id}:${command.id}`) || undefined : fallback
    },
  }
}
