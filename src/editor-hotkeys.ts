import { Platform } from 'obsidian'
import type { Hotkey, Plugin } from 'obsidian'
import type { Editor } from 'slate'
import { ReactEditor } from 'slate-react'
import { HistoryEditor } from 'slate-history'
import { indentCurrentBlock } from './blocks/model'
import { canInsertMath } from './wysimark/math-plugin'
import { clearFormatting } from './wysimark/marks-plugin/methods/clear-formatting'
import { t, ui } from './wysimark/utils/translations'

type EditorCommand = { id: string; name: string; hotkeys: Hotkey[]; nativeId?: string; available?: (editor: Editor) => boolean; run?: (editor: Editor) => void; readOnly?: boolean }
const key = (key: string, ...modifiers: Hotkey['modifiers']): Hotkey[] => [{ key, modifiers }]
/** One catalog supplies registered commands, editor dispatch and displayed shortcuts. */
export function editorCommands(): EditorCommand[] {
  return [
    { id: 'toggle-bold', nativeId: 'editor:toggle-bold', name: t('bold'), hotkeys: key('b', 'Mod'), run: e => e.marksPlugin.toggleBold() },
    { id: 'toggle-italic', nativeId: 'editor:toggle-italics', name: t('italic'), hotkeys: key('i', 'Mod'), run: e => e.marksPlugin.toggleItalic() },
    { id: 'toggle-underline', name: t('underline'), hotkeys: key('u', 'Mod'), run: e => e.marksPlugin.toggleUnderline() },
    { id: 'toggle-strikethrough', nativeId: 'editor:toggle-strikethrough', name: t('strike'), hotkeys: key('x', 'Mod', 'Shift'), run: e => e.marksPlugin.toggleStrike() },
    { id: 'toggle-inline-code', nativeId: 'editor:toggle-code', name: t('inlineCode'), hotkeys: key('e', 'Mod'), run: e => e.inlineCode.toggleInlineCode() },
    { id: 'toggle-highlight', nativeId: 'editor:toggle-highlight', name: ui('高亮'), hotkeys: key('h', 'Mod', 'Alt'), run: e => e.marksPlugin.toggleHighlight() },
    { id: 'paragraph', nativeId: 'editor:set-heading-0', name: t('normal'), hotkeys: key('0', 'Mod', 'Alt'), run: e => e.collapsibleParagraph.convertParagraph() },
    ...([1, 2, 3, 4, 5] as const).map(level => ({ id: `heading-${level}`, nativeId: `editor:set-heading-${level}`, name: t(`heading${level}`), hotkeys: key(String(level), 'Mod', 'Alt'), run: (e: Editor) => { e.heading.convertHeading(level, true) } })),
    { id: 'toggle-ordered-list', nativeId: 'editor:toggle-numbered-list', name: t('numberedList'), hotkeys: key('7', 'Mod', 'Shift'), run: e => e.list.convertOrderedList(true) },
    { id: 'toggle-unordered-list', nativeId: 'editor:toggle-bullet-list', name: t('bulletList'), hotkeys: key('8', 'Mod', 'Shift'), run: e => e.list.convertUnorderedList(true) },
    { id: 'toggle-task-list', name: t('checkList'), hotkeys: key('9', 'Mod', 'Shift'), run: e => e.list.convertTaskList(true) },
    { id: 'toggle-quote', nativeId: 'editor:toggle-blockquote', name: ui('引用'), hotkeys: key('u', 'Mod', 'Shift'), run: e => e.blockQuotePlugin.isActive() ? e.blockQuotePlugin.outdent() : e.blockQuotePlugin.indent() },
    { id: 'indent-block', nativeId: 'editor:indent-list', name: ui('仅缩进当前块'), hotkeys: key(']', 'Mod'), run: e => { indentCurrentBlock(e, 1) } },
    { id: 'outdent-block', nativeId: 'editor:unindent-list', name: ui('仅回退当前块'), hotkeys: key('[', 'Mod'), run: e => { indentCurrentBlock(e, -1) } },
    { id: 'insert-link', nativeId: 'editor:insert-link', name: t('insertLink'), hotkeys: key('k', 'Mod'), run: e => e.wysimark.openLink?.() },
    ...(['insertTable', 'insertAttachment', 'codeBlock', 'horizontalRule'] as const).map((title, index) => ({
      id: ['insert-table', 'insert-attachment', 'insert-code-block', 'insert-horizontal-rule'][index],
      nativeId: ['editor:insert-table', 'editor:attach-file', 'editor:insert-codeblock', 'editor:insert-horizontal-rule'][index],
      name: t(title), hotkeys: [], run: (e: Editor) => e.wysimark.openToolbarTool?.(t(title)),
    })),
    { id: 'undo', name: ui('撤销'), hotkeys: key('z', 'Mod'), run: e => { if (HistoryEditor.isHistoryEditor(e)) e.undo() } },
    { id: 'redo', name: ui('重做'), hotkeys: [...key('z', 'Mod', 'Shift'), ...key('y', 'Mod')], run: e => { if (HistoryEditor.isHistoryEditor(e)) e.redo() } },
    { id: 'save-note', nativeId: 'editor:save-file', name: ui('保存笔记'), hotkeys: key('s', 'Mod'), run: e => { void e.wysimark.save?.() }, readOnly: true },
    { id: 'find-text', nativeId: 'editor:open-search', name: ui('查找当前文档'), hotkeys: key('f', 'Mod'), readOnly: true, run: e => e.wysimark.openSearch?.(false) },
    { id: 'replace-text', nativeId: 'editor:open-search-replace', name: ui('替换当前文档'), hotkeys: key('h', 'Mod'), run: e => e.wysimark.openSearch?.(true) },
    { id: 'toggle-reading', nativeId: 'markdown:toggle-preview', name: ui('切换富文本编辑与阅读'), hotkeys: key('p', 'Mod', 'Alt'), readOnly: true, run: e => { void e.wysimark.toggleReading?.() } },
    { id: 'text-color', name: ui('应用上次字体颜色'), hotkeys: key('c', 'Mod', 'Alt') },
    { id: 'insert-inline-math', nativeId: 'editor:toggle-inline-math', name: ui('插入行内公式'), hotkeys: key('m', 'Mod', 'Shift'), available: canInsertMath, run: e => { e.math.insertInline() } },
    { id: 'clear-formatting', nativeId: 'editor:clear-formatting', name: ui('清除格式'), hotkeys: [], run: clearFormatting },
    { id: 'insert-drawing', name: ui('插入画板'), hotkeys: [] },
  ]
}

const physicalModifiers = (hotkey: Hotkey, mac: boolean) => hotkey.modifiers.map(m => m === 'Mod' ? mac ? 'Meta' : 'Ctrl' : m)
const hotkeyIdentity = (hotkey: Hotkey) => [...physicalModifiers(hotkey, Platform.isMacOS).sort(), hotkey.key.toLowerCase()].join(':')

export function matchesHotkey(event: KeyboardEvent, hotkey: Hotkey, mac = Platform.isMacOS): boolean {
  const modifiers = new Set(physicalModifiers(hotkey, mac))
  const physical = /^Key([A-Z])$/.exec(event.code)?.[1] ?? /^Digit([0-9])$/.exec(event.code)?.[1]
  return (event.key.toLowerCase() === hotkey.key.toLowerCase() || physical?.toLowerCase() === hotkey.key.toLowerCase()) &&
    !!event.ctrlKey === modifiers.has('Ctrl') && !!event.metaKey === modifiers.has('Meta') &&
    !!event.altKey === modifiers.has('Alt') && !!event.shiftKey === modifiers.has('Shift')
}

type HotkeyHost = {
  getHotkeys(id: string): Hotkey[] | undefined
  getDefaultHotkeys(id: string): Hotkey[] | undefined
  addDefaultHotkeys?(id: string, hotkeys: Hotkey[]): void
  removeDefaultHotkeys?(id: string): void
  setHotkeys?(id: string, hotkeys: Hotkey[]): void
  save?(): Promise<void>
  printHotkeyForCommand(id: string): string
}
type NativeCommand = { checkCallback?: (checking: boolean) => boolean | void }
type CommandHost = { commands?: Record<string, NativeCommand>; executeCommandById(id: string): void }

function canRun(command: EditorCommand, editor: Editor): boolean {
  return (!editor.wysimark.readOnly || !!command.readOnly) && (command.available?.(editor) ?? true)
}

export function installEditorHotkeys(plugin: Plugin, getEditor: () => Editor | undefined) {
  const { hotkeyManager: manager, commands: host, plugins } = plugin.app as unknown as {
    hotkeyManager: HotkeyHost; commands: CommandHost; plugins?: { manifests?: Record<string, unknown> }
  }
  const registry = host?.commands ?? {}
  const bindings = editorCommands().map(command => {
    const native = command.nativeId ? registry[command.nativeId] : undefined
    const id = native ? command.nativeId! : `${plugin.manifest.id}:${command.id}`
    if (command.run) {
      const check = (editor: Editor, checking: boolean) => {
        if (!canRun(command, editor)) return false
        if (!checking) { if (!command.readOnly) ReactEditor.focus(editor); command.run!(editor) }
        return true
      }
      if (native) {
        const original = native.checkCallback
        if (original) {
          // The native palette and global hotkey still own this command.
          const wrapped = function (this: NativeCommand, checking: boolean) {
            const editor = getEditor()
            return editor ? check(editor, checking) : original.call(this, checking)
          }
          native.checkCallback = wrapped
          plugin.register(() => { if (native.checkCallback === wrapped) native.checkCallback = original })
        }
      } else {
        plugin.addCommand({ id: command.id, name: command.name, hotkeys: command.hotkeys, checkCallback: checking => {
          const editor = getEditor()
          return !!editor && check(editor, checking)
        } })
      }
    }
    return { command, id, native: !!native }
  })
  const effective = (id: string) => manager.getHotkeys(id) ?? manager.getDefaultHotkeys(id) ?? []
  // Other editor plugins may use the same key in their own views, like Excalidraw's save.
  const assignedKeys = () => new Set(Object.keys(registry).filter(id => {
    const owner = id.split(':', 1)[0]
    return owner === plugin.manifest.id || !plugins?.manifests?.[owner]
  }).flatMap(id => effective(id).map(hotkeyIdentity)))
  const previousKeys = (command: EditorCommand) => manager.getHotkeys(`${plugin.manifest.id}:${command.id}`) ?? command.hotkeys
  const claim = (keys: Hotkey[], taken: Set<string>) => keys.filter(hotkey => {
    const identity = hotkeyIdentity(hotkey)
    if (taken.has(identity)) return false
    taken.add(identity)
    return true
  })
  // Keep unclaimed Blo shortcuts as defaults of the shared native command.
  // Explicit native customizations, including an empty list, are authoritative.
  if (manager.addDefaultHotkeys && manager.removeDefaultHotkeys) {
    const taken = assignedKeys()
    for (const { command, id, native } of bindings) {
      if (!native || manager.getHotkeys(id) !== undefined) continue
      const original = manager.getDefaultHotkeys(id)
      const extra = claim(previousKeys(command), taken)
      if (!extra.length) continue
      const defaults = [...(original ?? []), ...extra]
      manager.addDefaultHotkeys(id, defaults)
      plugin.register(() => {
        if (manager.getDefaultHotkeys(id) !== defaults) return
        if (original) manager.addDefaultHotkeys!(id, original)
        else manager.removeDefaultHotkeys!(id)
      })
    }
  }
  // Suppress old editor fallbacks after a hotkey has been removed or reassigned.
  const legacy = [key('j', 'Mod'), ...['0','1','2','3','4','5','7','8','9','k','.',','].map(k => key(k, 'Mod', Platform.isMacOS ? 'Alt' : 'Shift'))].flat()
  const retiredBindings = [...bindings.flatMap(({ command }) => command.hotkeys), ...legacy]
  const aliases: Record<string, string> = { [ui('清除文字样式')]: 'clear-formatting', [ui('字体颜色')]: 'text-color', [ui('查找／替换')]: 'find-text' }
  return {
    commandHotkeys(id: string): Hotkey[] {
      return effective(`${plugin.manifest.id}:${id}`)
    },
    async migrateClearedNativeBindings(): Promise<boolean> {
      if (!manager.setHotkeys || !manager.save) return false
      const taken = assignedKeys()
      const migrated: { id: string; keys: Hotkey[]; before: Hotkey[] }[] = []
      for (const { command, id, native } of bindings) {
        const before = native ? manager.getHotkeys(id) : undefined
        if (!before || before.length) continue
        const keys = claim(previousKeys(command), taken)
        if (keys.length) migrated.push({ id, keys, before })
      }
      for (const { id, keys } of migrated) manager.setHotkeys(id, keys)
      try {
        if (migrated.length) await manager.save()
      } catch (error) {
        for (const { id, keys, before } of migrated) if (manager.getHotkeys(id) === keys) manager.setHotkeys(id, before)
        throw error
      }
      return true
    },
    handle(editor: Editor, event: KeyboardEvent): boolean {
      if (event.isComposing) return false
      const matches = (hotkey: Hotkey) => matchesHotkey(event, hotkey)
      const binding = bindings.find(({ id }) => effective(id).some(matches))
      if (!binding) {
        if (!retiredBindings.some(matches) || Object.keys(registry).some(id => effective(id).some(matches))) return false
      }
      event.preventDefault(); event.stopPropagation()
      if (binding && canRun(binding.command, editor)) {
        if (binding.command.run) binding.command.run(editor)
        else host.executeCommandById(binding.id)
      }
      return true
    },
    label(title: string, fallback?: string): string | undefined {
      const binding = bindings.find(({ command }) => command.name === title || command.id === aliases[title])
      if (!binding) return fallback
      return manager.printHotkeyForCommand(binding.id) || undefined
    },
  }
}
