import { App, Component, Notice, Plugin, TFile, ItemView, WorkspaceLeaf, setIcon, addIcon, removeIcon } from 'obsidian'
import { ui } from './wysimark/utils/translations'
import { DrawingSaveAsModal, DRAWING_SAVE_AS_ICON, DRAWING_SAVE_AS_SVG } from './drawing-save-as'

type DrawingView = ItemView & { file?: TFile; forceSave?: () => Promise<void> }
type ReturnSession = {
  leaf: WorkspaceLeaf; view: DrawingView; file: TFile
  source: WorkspaceLeaf; sourceFile: TFile; sourceType: string; sourceState: Record<string, unknown>
  bar: HTMLElement; button: HTMLButtonElement; returning: boolean; dispose: () => void
}
const navigations = new WeakMap<App, DrawingNavigation>()

class DrawingNavigation extends Component {
  private sessions = new Map<WorkspaceLeaf, ReturnSession>()
  private disposed = false
  constructor(private app: App) { super() }

  onload() {
    this.registerEvent(this.app.workspace.on('layout-change', () => this.refresh()))
    this.registerEvent(this.app.workspace.on('file-open', () => this.refresh()))
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refresh()))
  }
  onunload() {
    this.disposed = true
    for (const session of this.sessions.values()) session.dispose()
    this.sessions.clear()
    navigations.delete(this.app)
  }
  private refresh() {
    const leaves = this.app.workspace.getLeavesOfType('excalidraw')
    for (const [leaf, session] of this.sessions) {
      if (!leaves.includes(leaf) || leaf.view !== session.view || session.view.file !== session.file) {
        session.dispose(); this.sessions.delete(leaf)
      } else {
        session.view.contentEl.addClass('blo-drawing-return-layout')
        if (!session.view.contentEl.contains(session.bar)) session.view.contentEl.prepend(session.bar)
      }
    }
  }
  async open(file: TFile, source: WorkspaceLeaf, sourceFile: TFile): Promise<void> {
    this.refresh()
    const previous = Array.from(this.sessions.values()).find(session => session.file === file && session.source === source && session.sourceFile === sourceFile)
    if (previous) {
      await this.app.workspace.revealLeaf(previous.leaf)
      this.app.workspace.setActiveLeaf(previous.leaf, { focus: true })
      return
    }
    const sourceType = source.view.getViewType(), sourceState = source.view.getState()
    // Own a dedicated tab; returning must never close an independently opened drawing.
    this.app.workspace.setActiveLeaf(source, { focus: false })
    const leaf = this.app.workspace.getLeaf('tab')
    await leaf.setViewState({ type: 'excalidraw', state: { file: file.path }, active: true })
    await this.app.workspace.revealLeaf(leaf)
    if (this.disposed) return
    const view = leaf.view as DrawingView
    if (view.getViewType() !== 'excalidraw' || view.file !== file) return
    const bar = view.contentEl.ownerDocument.createElement('div')
    bar.className = 'blo-drawing-return-bar'
    const button = bar.createEl('button', { attr: { type: 'button', 'aria-label': ui('返回笔记') } })
    setIcon(button.createSpan(), 'arrow-left')
    button.createSpan({ text: ui('返回笔记') })
    const click = () => { void this.returnToSource(session) }
    const saveAs = view.addAction(DRAWING_SAVE_AS_ICON, ui('画板另存为'), () => new DrawingSaveAsModal(this.app, file).open())
    const positionSaveAs = () => {
      const save = view.containerEl.querySelector('.view-actions .lucide-save')?.closest<HTMLElement>('.view-action')
      if (save && save.previousElementSibling !== saveAs) save.before(saveAs)
    }
    // Excalidraw adds its header actions asynchronously after opening the view.
    const actionObserver = new MutationObserver(positionSaveAs)
    const header = saveAs.closest('.view-header') || saveAs.parentElement
    if (header) actionObserver.observe(header, { childList: true, subtree: true })
    positionSaveAs()
    // Excalidraw rebuilds its content after the view first opens.
    const observer = new MutationObserver(() => {
      if (this.disposed || leaf.view !== view || view.file !== file) return
      view.contentEl.addClass('blo-drawing-return-layout')
      if (!view.contentEl.contains(bar)) view.contentEl.prepend(bar)
    })
    const session: ReturnSession = { leaf, view, file, source, sourceFile, sourceType, sourceState, bar, button, returning: false,
      dispose: () => { observer.disconnect(); actionObserver.disconnect(); button.removeEventListener('click', click); saveAs.remove(); bar.remove(); view.contentEl.removeClass('blo-drawing-return-layout') } }
    button.addEventListener('click', click)
    view.contentEl.addClass('blo-drawing-return-layout')
    view.contentEl.prepend(bar)
    observer.observe(view.contentEl, { childList: true })
    this.sessions.set(leaf, session)
    this.app.workspace.setActiveLeaf(leaf, { focus: true })
  }
  private async returnToSource(session: ReturnSession): Promise<void> {
    if (session.returning || this.disposed) return
    session.returning = true; session.button.disabled = true
    try {
      if (session.leaf.view !== session.view || session.view.file !== session.file || !session.view.forceSave) throw new Error('Drawing view changed')
      await session.view.forceSave()
      if (this.disposed) return
      if (this.app.vault.getAbstractFileByPath(session.sourceFile.path) !== session.sourceFile) throw new Error('Source note no longer exists')
      let source = session.source
      const candidates = this.app.workspace.getLeavesOfType(session.sourceType)
      if (!candidates.includes(source) || source.getViewState().state?.file !== session.sourceFile.path) {
        source = candidates.find(leaf => leaf.getViewState().state?.file === session.sourceFile.path) ?? this.app.workspace.getLeaf('tab')
        if (source.getViewState().state?.file !== session.sourceFile.path) await source.setViewState({
          type: session.sourceType, state: { ...session.sourceState, file: session.sourceFile.path }, active: true,
        })
      }
      await this.app.workspace.revealLeaf(source)
      this.app.workspace.setActiveLeaf(source, { focus: true })
      session.dispose(); this.sessions.delete(session.leaf)
      // Do not close the tab if the user repurposed it while saving.
      if (session.leaf.view === session.view && session.view.file === session.file) session.leaf.detach()
    } catch (error) {
      console.error('Blo Editor: could not return from drawing', error)
      new Notice(ui('无法返回笔记，画板仍保留打开'))
    } finally { session.returning = false; session.button.disabled = false }
  }
}

export function installDrawingNavigation(plugin: Plugin): void {
  addIcon(DRAWING_SAVE_AS_ICON, DRAWING_SAVE_AS_SVG)
  plugin.register(() => removeIcon(DRAWING_SAVE_AS_ICON))
  const navigation = new DrawingNavigation(plugin.app)
  navigations.set(plugin.app, navigation)
  plugin.addChild(navigation)
}

export async function openEmbeddedDrawing(app: App, file: TFile, source: WorkspaceLeaf, sourceFile: TFile): Promise<boolean> {
  const navigation = navigations.get(app)
  if (!navigation) return false
  await navigation.open(file, source, sourceFile)
  return true
}
