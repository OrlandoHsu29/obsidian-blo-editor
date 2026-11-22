import { Platform } from 'obsidian'
import type { Hotkey } from 'obsidian'
import { ui } from './wysimark/utils/translations'

type NativeItem = {
  label?: string
  role?: 'cut' | 'copy' | 'paste' | 'pasteAndMatchStyle'
  accelerator?: string
  registerAccelerator?: boolean
  type?: 'separator'
  enabled?: boolean
  click?: () => void
}

function nativeAccelerator({ key, modifiers }: Hotkey): string | undefined {
  const nativeKey = key === '+' ? 'Plus' : key === ' ' ? 'Space' : key.replace(/^Arrow(?=Up$|Down$|Left$|Right$)/, '')
  if (!/^(?:[a-z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|[.,/;='\[\]\\`-]|Plus|Space|Tab|Backspace|Delete|Insert|Enter|Return|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape)$/i.test(nativeKey)) return
  return [...modifiers.map(modifier => modifier === 'Mod' ? 'CmdOrCtrl' : modifier), nativeKey].join('+')
}

type ContextDetails = {
  editFlags?: { canCut?: boolean; canCopy?: boolean; canPaste?: boolean }
  misspelledWord?: string
  dictionarySuggestions?: string[]
}

type DesktopWindow = Window & {
  electron?: {
    ipcRenderer: {
      on(channel: string, listener: (_event: unknown, details: ContextDetails) => void): void
      removeListener(channel: string, listener: (_event: unknown, details: ContextDetails) => void): void
      send(channel: string): void
    }
    remote: {
      Menu: { buildFromTemplate(items: NativeItem[]): { popup(options: { window: unknown }): void } }
      getCurrentWindow(): unknown
      getCurrentWebContents(): {
        replaceMisspelling(word: string): void
        showDefinitionForSelection(): void
        session: { addWordToSpellCheckerDictionary(word: string): void }
      }
    }
  }
}

/** Obsidian's desktop shell can hand over the context details instead of
 * opening its default Electron menu. Use native roles for clipboard actions. */
export function addSelectionContextAction(
  event: MouseEvent,
  host: HTMLElement,
  editable: boolean,
  action: { label: string; hotkeys?: readonly Hotkey[]; run: () => void },
) {
  const win = host.ownerDocument.defaultView as DesktopWindow | null
  const desktop = win?.electron
  if (!event.isTrusted || !win || !desktop?.remote?.Menu || !desktop.ipcRenderer) return

  const channel = 'context-menu'
  const { ipcRenderer, remote } = desktop
  const preview = host.ownerDocument.getSelection()?.toString().trim()
  event.stopImmediatePropagation()
  const timeout = win.setTimeout(() => ipcRenderer.removeListener(channel, show), 1000)
  function show(_event: unknown, details: ContextDetails) {
    ipcRenderer.removeListener(channel, show)
    win?.clearTimeout(timeout)
    if (!host.isConnected || !details) return
    const { editFlags, misspelledWord, dictionarySuggestions } = details
    const contents = remote.getCurrentWebContents()
    const items: NativeItem[] = []
    if (misspelledWord) {
      const suggestions = dictionarySuggestions?.slice(0, 5) ?? []
      if (!suggestions.length) items.push({ label: ui('无拼写建议'), enabled: false })
      for (const word of suggestions) items.push({ label: word, click: () => contents.replaceMisspelling(word) })
      items.push({ label: ui('添加到词典'), click: () => contents.session.addWordToSpellCheckerDictionary(misspelledWord) },
        { type: 'separator' })
    }
    if (Platform.isMacOS && preview) {
      items.push({ label: ui('查询「{text}」', { text: preview.length > 40 ? preview.slice(0, 39) + '…' : preview }),
        click: () => contents.showDefinitionForSelection() }, { type: 'separator' })
    }
    if (editable) items.push({ role: 'cut', label: ui('剪切'), accelerator: 'CmdOrCtrl+X', enabled: editFlags?.canCut })
    items.push({ role: 'copy', label: ui('复制'), accelerator: 'CmdOrCtrl+C', enabled: editFlags?.canCopy })
    if (editable) items.push(
      { role: 'paste', label: ui('粘贴'), accelerator: 'CmdOrCtrl+V', enabled: editFlags?.canPaste },
      { role: 'pasteAndMatchStyle', label: ui('粘贴为纯文本'), accelerator: 'CmdOrCtrl+Shift+V', enabled: editFlags?.canPaste },
    )
    const accelerator = action.hotkeys?.map(nativeAccelerator).find(Boolean)
    items.push({ type: 'separator' }, {
      label: action.label, accelerator, registerAccelerator: false, click: action.run,
    })
    remote.Menu.buildFromTemplate(items).popup({ window: remote.getCurrentWindow() })
  }
  ipcRenderer.on(channel, show)
  ipcRenderer.send(channel)
}
