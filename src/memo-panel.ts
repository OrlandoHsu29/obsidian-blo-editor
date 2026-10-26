import { App, TFile, WorkspaceLeaf, WorkspaceWindow } from 'obsidian'

/**
 * Flash Memo hosts the quick memo panel: a small popout window that keeps one
 * note (or drawing) and shows its own name bar. Blo only reads the public
 * pieces it needs -- the plugin id, the body class that marks the window and
 * the current memo file -- so neither plugin has to depend on the other.
 */
export const MEMO_PANEL_PLUGIN_ID = 'flash-memo'
const MEMO_PANEL_BODY_CLASS = 'flash-memo-window'
const MEMO_PANEL_COMMAND_ID = `${MEMO_PANEL_PLUGIN_ID}:toggle`

type MemoPanelPlugin = {
  settings?: { file?: string }
  toggle?: () => Promise<void>
}

function memoPanelPlugin(app: App): MemoPanelPlugin | undefined {
  const registry = (app as App & { plugins?: { plugins?: Record<string, unknown> } }).plugins?.plugins
  return registry?.[MEMO_PANEL_PLUGIN_ID] as MemoPanelPlugin | undefined
}

export function memoPanelInstalled(app: App): boolean {
  return !!memoPanelPlugin(app)
}

/** The document of a desktop popout window, or null for main-window leaves. */
export function popoutDocument(leaf: WorkspaceLeaf): Document | null {
  const container = leaf.getContainer()
  return container instanceof WorkspaceWindow ? container.doc : null
}

/** True while a document is the quick memo popout. */
export function isMemoPanelDocument(doc: Document): boolean {
  return !!doc.body?.classList.contains(MEMO_PANEL_BODY_CLASS)
}

/**
 * The body class is added once the popout attaches, which happens after the
 * first view state is set. The current memo file covers that first note, and
 * works for file switches made before the class is available.
 */
export function isMemoPanelLeaf(app: App, leaf: WorkspaceLeaf, file?: TFile | null): boolean {
  const doc = popoutDocument(leaf)
  if (!doc) return false
  if (isMemoPanelDocument(doc)) return true
  const current = memoPanelPlugin(app)?.settings?.file
  return !!file && !!current && current === file.path
}

/** Open or hide the quick memo panel without depending on its internal state. */
export async function toggleMemoPanel(app: App): Promise<boolean> {
  const commands = (app as App & { commands?: { executeCommandById(id: string): boolean } }).commands
  try { if (commands?.executeCommandById?.(MEMO_PANEL_COMMAND_ID)) return true } catch { /* Use the plugin instance below. */ }
  const plugin = memoPanelPlugin(app)
  if (!plugin?.toggle) return false
  await plugin.toggle()
  return true
}
