import { isPathInEditingScope } from './editing-scope';
import { installImageViewerIntegration } from './image-viewer-integration';
import { ui } from "./wysimark/utils/translations"
import { createEditorStyleCache } from './style-cache';
import { installOutlineFilter } from './outline';
import { Plugin, WorkspaceLeaf, TFile, MarkdownView, Notice, setIcon, setTooltip } from 'obsidian';
import { DEFAULT_SETTINGS, BloSettingsTab } from './settings';
import type { EditorSettings } from './settings';
import { BloView, VIEW_TYPE_BLO } from "./BloView";
import type { Editor } from 'slate';
import { ReactEditor } from 'slate-react';
import { canOpenSlashMenu } from './slash-menu';
import { applyTextColor, toggleTextColor } from './wysimark/marks-plugin/methods/text-color';
import { clearFormatting } from './wysimark/marks-plugin/methods/clear-formatting';
import { isDrawingFile, openDrawing } from './drawings';
import { installDrawingNavigation } from './drawing-navigation';
import { PdfExportModal } from './pdf-export';
import { ToolbarPreferences } from './toolbar-preferences';
import { parseBlockDocument } from './blocks/persistence';
import { IntegrationPreferences } from './integration-preferences';
import { ensureOptionalPlugin, optionalPluginManager, OPTIONAL_PLUGINS } from './optional-integrations';
import { isMemoPanelLeaf, isMemoPanelDocument, memoPanelEnabled, memoPanelStatus, popoutDocument, toggleMemoPanel } from './memo-panel';
import { MemoPanelSetupModal, setupMemoPanel } from './memo-panel-setup';
import { canInsertMath } from './wysimark/math-plugin';

const INTEGRATION_SETTINGS = {
  imageViewer: { key: 'enableImageViewer', name: 'Image Toolkit' },
  drawings: { key: 'enableDrawings', name: 'Excalidraw' },
  memoPanel: { key: 'enableMemoPanel', name: 'Flash Memo' },
} as const;
type IntegrationFeature = keyof typeof INTEGRATION_SETTINGS;

export default class BloEditorPlugin extends Plugin {
  readonly styleCache=createEditorStyleCache();
  readonly toolbarPreferences = new ToolbarPreferences();
  readonly integrationPreferences = new IntegrationPreferences();
  private disposed = false;
  private memoSetup: MemoPanelSetupModal | null = null;
  private memoWindows = new Map<Document, MutationObserver>();
  settings: EditorSettings = { ...DEFAULT_SETTINGS };
  private nativeLeaves = new WeakSet<WorkspaceLeaf>();
  private openingLeaves = new WeakSet<WorkspaceLeaf>();
  private pdfExportLeaves = new WeakSet<WorkspaceLeaf>();
  private bloFormatCache = new WeakMap<TFile, { mtime: number; size: number; result: Promise<boolean> }>();
  async onload(): Promise<void> {
    await super.onload();
    this.register(()=>this.styleCache.cache.sheet.flush());
    installOutlineFilter(this,file=>{
      const active=this.app.workspace.getActiveViewOfType(BloView);
      if(active?.currentFile===file)return active.editor??undefined;
      for(const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_BLO)) {
        const view=leaf.view;
        if(view instanceof BloView&&view.currentFile===file)return view.editor??undefined;
      }
    });
    // Set native tooltip options before Obsidian's delegated hover handler runs.
    this.registerDomEvent(document,'mouseover',event=>{
      const control=(event.target as Element|null)?.closest<HTMLElement>('[aria-label]');
      if(!control?.closest('.wysimark-container, .wysimark-overlay, .oit-img-toolbar'))return;
      const placement=control.dataset.tooltipPosition;
      setTooltip(control,control.getAttribute('aria-label')!,{delay:150,...(['top','bottom','left','right'].includes(placement||'')?{placement:placement as 'top'|'bottom'|'left'|'right'}:{})});
    },true);
    const savedSettings = await this.loadData();
    this.settings = Object.assign(this.settings, savedSettings);
    // Do not broaden an old per-type deletion opt-in to every embedded medium.
    if (typeof savedSettings?.deleteEmbeddedAttachments !== 'boolean') this.settings.deleteEmbeddedAttachments = false;
    delete (this.settings as any).deleteImageAttachments;
    delete (this.settings as any).deleteDrawingAttachments;
    if (!Array.isArray(this.settings.integrationOptOut)) this.settings.integrationOptOut = [];
    this.syncIntegrations();
    this.toolbarPreferences.setHidden(Array.isArray(this.settings.hiddenToolbarButtons) ? this.settings.hiddenToolbarButtons : []);
    this.addSettingTab(new BloSettingsTab(this));
    installDrawingNavigation(this);
    installImageViewerIntegration(this);

    // Reuse Image Toolkit's viewer without intercepting Slate's single-click selection.
    const previewImage = (event: MouseEvent) => {
      if (!this.settings.enableImageViewer) return;
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.closest('.wysimark-container')) return;
      if (event.type === 'click' && !image.closest('.wysimark-reading')) return;
      const toolkit = (this.app as any).plugins.plugins['obsidian-image-toolkit'];
      toolkit?.clickImage?.(event);
    };
    this.registerDomEvent(document, 'dblclick', previewImage);
    this.registerDomEvent(document, 'click', previewImage);

    // Register the Wysimark view
    this.registerView(VIEW_TYPE_BLO, (leaf) => new BloView(leaf, this));
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source) => {
      if (!source.includes('file-explorer') || !(file instanceof TFile) || file.extension !== 'md' || isDrawingFile(this.app, file)) return;
      menu.addItem(item => item.setTitle(ui('导出 PDF')).setIcon('file-down').setSection('action').onClick(() => {
        void this.exportFileToPdf(file).catch(error => new Notice(ui('PDF 导出失败：') + String(error).slice(0, 300)));
      }));
    }));
    this.addCommand({ id: 'export-pdf', name: ui('导出 PDF'), checkCallback: checking => {
      const view = this.app.workspace.getActiveViewOfType(BloView);
      if (!view?.editor || !view.currentFile) return false;
      if (!checking) new PdfExportModal(view).open();
      return true;
    }});
    this.addCommand({id:'clear-formatting',name:ui("清除文字样式"),checkCallback:checking=>{
      const view=this.app.workspace.getActiveViewOfType(BloView);if(!view?.editor||view.readOnly)return false;
      if(!checking)clearFormatting(view.editor);return true;
    }});
    this.addCommand({ id: 'insert-inline-math', name: ui('插入行内公式'), hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'm' }], checkCallback: checking => {
      const view = this.app.workspace.getActiveViewOfType(BloView);
      if (!view?.editor || view.readOnly || !canInsertMath(view.editor)) return false;
      if (!checking) view.editor.math.insertInline();
      return true;
    }});
    for (const [id, name, key, replace] of [['find-text',ui("查找当前文档"),'f',false],['replace-text',ui("替换当前文档"),'h',true]] as const) {
      this.addCommand({id, name, hotkeys:[{modifiers:['Mod'],key}], checkCallback:checking=>{
        const view=this.app.workspace.getActiveViewOfType(BloView);
        if (!view?.editor) return false;
        if (!checking) view.showSearch(replace);
        return true;
      }});
    }
    this.addCommand({id: 'slash-menu', name: ui("打开简洁命令菜单"), checkCallback: checking => {
      const view = this.app.workspace.getActiveViewOfType(BloView);
      if (!view?.editor || !canOpenSlashMenu(view.editor)) return false;
      if (!checking) { view.editor.insertText('/'); ReactEditor.focus(view.editor); }
      return true;
    }});
    this.addCommand({ id: 'insert-drawing', name: ui('插入画板'), checkCallback: checking => {
      if (!this.settings.enableDrawings) return false;
      const view = this.app.workspace.getActiveViewOfType(BloView);
      if (!view?.editor || !view.currentFile || view.readOnly) return false;
      if (!checking) void view.editor.wysimark.insertDrawing?.();
      return true;
    }});
    this.addCommand({ id: 'toggle-memo-panel', name: ui('打开/关闭速记面板'), checkCallback: checking => {
      if (!this.settings.enableMemoPanel || !memoPanelEnabled(this.app)) return false;
      if (!checking) void this.toggleMemoPanelWindow();
      return true;
    }});
    this.addCommand({ id: 'text-color', name: ui("应用上次字体颜色"), hotkeys: [{ modifiers: ['Mod', 'Alt'], key: 'C' }], checkCallback: checking => {
      const view = this.app.workspace.getActiveViewOfType(BloView);
      if (!(view instanceof BloView) || view.readOnly || !view.editor) return false;
      if (!checking) {
        if (this.settings.defaultTextColor) toggleTextColor(view.editor, this.settings.defaultTextColor);
        else applyTextColor(view.editor, null);
      }
      return true;
    }});
    this.registerDomEvent(document, 'click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement;
      const item = target.closest?.('.tree-item-self');
      if (!item || target.closest('.collapse-icon')) return;
      const outline = this.app.workspace.getLeavesOfType('outline').find(leaf => leaf.view.containerEl.contains(item))?.view as any;
      const heading = outline?.cachedHeadingDom?.find((node: any) => node.selfEl === item)?.heading;
      if (!heading || !outline.file) return;
      const active = this.app.workspace.getActiveViewOfType(BloView);
      const view = active instanceof BloView && active.currentFile === outline.file ? active :
        this.app.workspace.getLeavesOfType(VIEW_TYPE_BLO).map(leaf => leaf.view).find(view => view instanceof BloView && view.currentFile === outline.file) as BloView | undefined;
      if (!view) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void this.app.workspace.revealLeaf(view.leaf);
      view.navigateToHeading(heading.__bloSourceHeading??heading.heading, heading.position.start.line,heading.__bloHeadingIndex);
    }, { capture: true });

    // Add ribbon icon to show/toggle the view
    this.addRibbonIcon('pencil', this.manifest.name, () => {
      void this.activateBloView();
    });

    // Add command to toggle sidebar
    this.addCommand({
      id: 'toggle-sidebar',
      name: ui("打开富文本编辑器"),
      callback: () => {
        void this.activateBloView();
      },
    });
    this.addCommand({ id: 'open-native-editor', name: ui("在当前标签打开原生编辑器"), callback: async () => {
      const leaf = this.app.workspace.activeLeaf;
      if (!leaf || !(leaf.view instanceof BloView) || !leaf.view.currentFile) return;
      const file = leaf.view.currentFile; await leaf.view.saveFile(); this.nativeLeaves.add(leaf);
      await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: false }, active: true });
    }});
    this.addCommand({ id: 'toggle-reading', name: ui("切换富文本编辑与阅读"), callback: async () => {
      const leaf = this.app.workspace.activeLeaf;
      if (!leaf) return;
      if (leaf.view instanceof BloView) { await leaf.view.editor?.wysimark.toggleReading?.(); return; }
      if (!(leaf.view instanceof MarkdownView) || !leaf.view.file) return;
      if (isDrawingFile(this.app, leaf.view.file)) return;
      const file = leaf.view.file, mode = leaf.view.getMode(); await leaf.view.save();
      if (this.settings.restrictExistingBloTabs && !this.isFileInEditingScope(file)) {
        await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: mode === 'preview' ? 'source' : 'preview' }, active: true });
        return;
      }
      await leaf.setViewState({ type: VIEW_TYPE_BLO, state: { file: file.path, mode: mode === 'preview' ? 'source' : 'preview' }, active: true });
    }});

    // Listen for active file changes
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf) {
          const view = leaf.view;
          if (view instanceof BloView) void this.enforceEditingScope(leaf);
          if (view instanceof MarkdownView) {
            const file = view.file;
            if (file && file.extension === 'md') {
              void this.openRichByDefault(leaf, file);
            }
          }
        }
      })
    );
    this.registerEvent(this.app.workspace.on('file-open', file => {
      const leaf = this.app.workspace.activeLeaf;
      if (leaf && file) {
        if (leaf.view instanceof BloView) void this.enforceEditingScope(leaf);
        else void this.openRichByDefault(leaf, file);
      }
    }));
    this.registerEvent(this.app.workspace.on('window-open', win => this.watchMemoWindow(win.doc)));
    this.registerEvent(this.app.workspace.on('window-close', win => {
      this.memoWindows.get(win.doc)?.disconnect();
      this.memoWindows.delete(win.doc);
    }));
    this.app.workspace.onLayoutReady(() => {
      if (this.disposed) return;
      for (const leaf of this.allLeaves()) {
        const doc = popoutDocument(leaf);
        if (doc) this.watchMemoWindow(doc);
      }
      // Dependencies load in any order, so detect them once the workspace is up.
      void this.enableDetectedIntegrations().then(() => {
        // A reload keeps the quick memo popout; put Blo back into it.
        if (this.settings.enableMemoPanel) void this.adoptMemoPanelViews();
      });
      void this.enforceEditingScope();
      const leaf = this.app.workspace.activeLeaf;
      if (leaf?.view instanceof MarkdownView && leaf.view.file) void this.openRichByDefault(leaf, leaf.view.file);
    });
  }
  /** Flash Memo marks its window after the initial Markdown view opens. */
  private watchMemoWindow(doc: Document) {
    if (this.disposed || this.memoWindows.has(doc) || !doc.body) return;
    const Observer = doc.defaultView?.MutationObserver;
    if (!Observer) return;
    let marked = isMemoPanelDocument(doc);
    const observer = new Observer(() => {
      const next = isMemoPanelDocument(doc);
      if (next === marked) return;
      marked = next;
      if (!marked || this.disposed) return;
      void this.enableDetectedIntegrations().then(() => this.adoptMemoPanelViews()).catch(error => {
        console.error('Blo Editor: could not adopt the quick memo panel', error);
      });
    });
    observer.observe(doc.body, { attributes: true, attributeFilter: ['class'] });
    this.memoWindows.set(doc, observer);
  }
  isFileInEditingScope(file: TFile): boolean {
    return file.extension === 'md' && isPathInEditingScope(file.path, this.settings.richEditingFolder);
  }
  /** The quick memo popout keeps its own single note; only Blo-owned tabs are scoped. */
  isMemoPanelLeaf(leaf: WorkspaceLeaf, file?: TFile | null): boolean {
    return isMemoPanelLeaf(this.app, leaf, file);
  }
  private async toggleMemoPanelWindow(): Promise<void> {
    try {
      if (!await toggleMemoPanel(this.app)) new Notice(ui('未检测到 Flash Memo，请先安装并启用速记面板插件'));
    } catch (error) {
      console.error('Blo Editor: could not toggle the quick memo panel', error);
      new Notice(ui('无法打开速记面板，请检查 Flash Memo 插件'));
    }
  }
  private syncIntegrations() {
    this.integrationPreferences.set({ imageViewer: this.settings.enableImageViewer, drawings: this.settings.enableDrawings });
  }
  private integrationDependencyEnabled(feature: IntegrationFeature): boolean {
    if (feature === 'memoPanel') return memoPanelEnabled(this.app);
    const manager = optionalPluginManager(this.app), id = OPTIONAL_PLUGINS[feature];
    return !!manager.plugins[id] || manager.enabledPlugins.has(id);
  }
  /**
   * An enabled dependency turns its integration on by itself, so a plugin the
   * user already runs needs no setup in Blo. Manually turning an integration off
   * records an opt-out that detection respects.
   */
  async enableDetectedIntegrations(): Promise<boolean> {
    if (this.disposed) return false;
    const optOut = new Set(this.settings.integrationOptOut);
    let changed = false;
    for (const feature of Object.keys(INTEGRATION_SETTINGS) as IntegrationFeature[]) {
      const { key } = INTEGRATION_SETTINGS[feature];
      if (this.settings[key] || optOut.has(feature) || !this.integrationDependencyEnabled(feature)) continue;
      this.settings[key] = true;
      changed = true;
    }
    if (!changed) return false;
    this.syncIntegrations();
    await this.saveData(this.settings);
    if (this.settings.enableMemoPanel) await this.adoptMemoPanelViews();
    return true;
  }
  private recordIntegrationChoice(feature: IntegrationFeature, enabled: boolean) {
    const choices = new Set(this.settings.integrationOptOut);
    if (enabled) choices.delete(feature); else choices.add(feature);
    this.settings.integrationOptOut = [...choices];
  }
  async setOptionalIntegration(feature: IntegrationFeature, enabled: boolean): Promise<boolean> {
    const { key, name } = INTEGRATION_SETTINGS[feature];
    const previous = this.settings[key];
    const previousChoices = [...this.settings.integrationOptOut];
    try {
      if (enabled && feature === 'memoPanel') {
        if (memoPanelStatus(this.app) === 'unsupported') {
          new Notice(ui('Flash Memo 仅支持桌面端'));
          return previous;
        }
        if (!memoPanelEnabled(this.app)) {
          if (this.memoSetup) return previous;
          const setup = setupMemoPanel(this.app);
          this.memoSetup = setup.modal;
          let ready: boolean;
          try { ready = await setup.result; }
          finally { this.memoSetup = null; }
          if (!ready) return previous;
        }
      }
      if (enabled && feature !== 'memoPanel') await ensureOptionalPlugin(this.app, feature);
      if (this.disposed) return previous;
      this.settings[key] = enabled;
      this.recordIntegrationChoice(feature, enabled);
      this.syncIntegrations();
      await this.saveData(this.settings);
    } catch (error) {
      this.settings[key] = previous;
      this.settings.integrationOptOut = previousChoices;
      this.syncIntegrations();
      console.error('Blo Editor: optional integration failed', error);
      new Notice(ui('无法启用 {name}，请检查网络或在第三方插件中手动安装并启用。', { name }));
    }
    if (feature === 'memoPanel' && this.settings[key] === enabled && !this.disposed) {
      try { await (enabled ? this.adoptMemoPanelViews() : this.releaseMemoPanelViews()); }
      catch (error) {
        console.error('Blo Editor: could not switch the quick memo editor', error);
        new Notice(ui('无法切换速记编辑器，请重新开关速记面板适配后重试。'));
      }
    }
    return this.settings[key];
  }
  private async adoptMemoPanelViews(): Promise<void> {
    if (this.disposed || !this.settings.enableMemoPanel || !memoPanelEnabled(this.app)) return;
    for (const leaf of this.allLeaves()) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file && this.isMemoPanelLeaf(leaf, view.file)) await this.openRichByDefault(leaf, view.file);
    }
  }
  private allLeaves(): WorkspaceLeaf[] {
    const leaves: WorkspaceLeaf[] = [];
    this.app.workspace.iterateAllLeaves(leaf => leaves.push(leaf));
    return leaves;
  }
  private async releaseMemoPanelViews(): Promise<void> {
    for (const leaf of this.allLeaves()) {
      const view = leaf.view;
      if (!(view instanceof BloView) || !view.currentFile || !this.isMemoPanelLeaf(leaf, view.currentFile)) continue;
      const file = view.currentFile, mode = view.getMode();
      await view.saveFile();
      if (this.disposed || this.settings.enableMemoPanel || leaf.view !== view || view.currentFile !== file) continue;
      await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode, source: false }, active: leaf === this.app.workspace.activeLeaf });
    }
  }
  isPdfExportLeaf(leaf: WorkspaceLeaf) { return this.pdfExportLeaves.has(leaf); }
  private async exportFileToPdf(file: TFile) {
    const workspace = this.app.workspace;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_BLO).map(leaf => leaf.view)
      .find((view): view is BloView => view instanceof BloView && view.currentFile === file && !!view.editor);
    if (existing) {
      await workspace.revealLeaf(existing.leaf);
      new PdfExportModal(existing).open();
      return;
    }
    for (const leaf of workspace.getLeavesOfType('markdown')) {
      if (leaf.view instanceof MarkdownView && leaf.view.file === file) await leaf.view.save();
    }
    // Explicit export also works outside the automatic editing folder. The
    // exception belongs only to this temporary read-only preview.
    const original = workspace.activeLeaf;
    const leaf = workspace.getLeaf('tab');
    this.pdfExportLeaves.add(leaf);
    const cleanup = () => {
      const restore = workspace.activeLeaf === leaf;
      this.pdfExportLeaves.delete(leaf);
      leaf.detach();
      if (restore && original && original.parent) void workspace.revealLeaf(original);
    };
    try {
      await leaf.setViewState({ type: VIEW_TYPE_BLO, state: { file: file.path, mode: 'preview' }, active: true });
      await workspace.revealLeaf(leaf);
      const deadline = Date.now() + 10000;
      while (leaf.view instanceof BloView && !leaf.view.editor && Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 25));
      }
      const view = leaf.view;
      if (!(view instanceof BloView) || view.currentFile !== file || !view.editor) throw new Error(ui('编辑器尚未就绪，请稍后重试'));
      new PdfExportModal(view, cleanup).open();
    } catch (error) { cleanup(); throw error; }
  }
  async enforceEditingScope(onlyLeaf?: WorkspaceLeaf): Promise<void> {
    if (!this.settings.restrictExistingBloTabs) return;
    for (const leaf of onlyLeaf ? [onlyLeaf] : this.app.workspace.getLeavesOfType(VIEW_TYPE_BLO)) {
      const view = leaf.view;
      if (!(view instanceof BloView) || !view.currentFile || this.isFileInEditingScope(view.currentFile) || this.isMemoPanelLeaf(leaf, view.currentFile) || isDrawingFile(this.app, view.currentFile) || this.openingLeaves.has(leaf) || this.pdfExportLeaves.has(leaf)) continue;
      const file = view.currentFile, mode = view.getMode();
      this.openingLeaves.add(leaf);
      try {
        await view.saveFile();
        if (!this.settings.restrictExistingBloTabs || leaf.view !== view || view.currentFile !== file || this.isFileInEditingScope(file) || this.isMemoPanelLeaf(leaf, file)) continue;
        await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode }, active: leaf === this.app.workspace.activeLeaf });
      } finally { this.openingLeaves.delete(leaf); }
    }
  }
  private async openRichByDefault(leaf: WorkspaceLeaf, file: TFile) {
    const memoPanel = this.isMemoPanelLeaf(leaf, file);
    // Flash Memo owns its popout; use Blo there only while the integration is on.
    if (this.disposed || memoPanel && (!this.settings.enableMemoPanel || !memoPanelEnabled(this.app))) return;
    // The memo panel is an explicit choice, so it opens with Blo outside the editing scope.
    const outsideScope = !memoPanel && !this.isFileInEditingScope(file);
    if (file.extension !== 'md' || isDrawingFile(this.app, file) || (!this.settings.preferRichEditing && !memoPanel) || this.nativeLeaves.has(leaf) || this.openingLeaves.has(leaf) ||
      (this.settings.restrictExistingBloTabs && outsideScope) ||
      !(leaf.view instanceof MarkdownView) || leaf.view.file?.path !== file.path) return;
    const mode = leaf.view.getMode();
    this.openingLeaves.add(leaf);
    try {
      await leaf.view.save();
      if (outsideScope) {
        if (this.settings.restrictExistingBloTabs) return;
        let cached = this.bloFormatCache.get(file);
        if (!cached || cached.mtime !== file.stat.mtime || cached.size !== file.stat.size) {
          cached = { mtime: file.stat.mtime, size: file.stat.size,
            result: this.app.vault.cachedRead(file).then(source => parseBlockDocument(source, () => []) !== null) };
          this.bloFormatCache.set(file, cached);
        }
        if (!await cached.result) return;
      }
      if (this.disposed || memoPanel !== this.isMemoPanelLeaf(leaf, file) || memoPanel && (!this.settings.enableMemoPanel || !memoPanelEnabled(this.app)) ||
        (!this.settings.preferRichEditing && !memoPanel) || (this.settings.restrictExistingBloTabs && outsideScope) || this.nativeLeaves.has(leaf) || isDrawingFile(this.app, file) || !(leaf.view instanceof MarkdownView) || leaf.view.file?.path !== file.path) return;
      await leaf.setViewState({ type: VIEW_TYPE_BLO, state: { file: file.path, mode }, active: leaf === this.app.workspace.activeLeaf });
    } catch (error) {
      this.bloFormatCache.delete(file);
      console.error('Blo Editor: could not restore rich editor', error);
    } finally {
      this.openingLeaves.delete(leaf);
      // The host may attach its marker while the native save is in flight.
      if (!this.disposed && !memoPanel && this.isMemoPanelLeaf(leaf, file)) void this.openRichByDefault(leaf, file);
    }
  }

  onunload(): void {
    this.disposed = true;
    this.memoSetup?.close();
    this.memoSetup = null;
    for (const observer of this.memoWindows.values()) observer.disconnect();
    this.memoWindows.clear();
    // Views, events, and commands registered via registerView/registerEvent/addCommand
    // are automatically cleaned up by Obsidian's plugin system.
    // Do NOT call detachLeavesOfType here to preserve user's layout during plugin updates.
  }

  // Activate/reveal the Wysimark view
  openTextColor(editor: Editor) {
    if (editor.wysimark.readOnly) return;
    const root = ReactEditor.toDOMNode(editor, editor).closest('.wysimark-container');
    root?.querySelector('[data-wysimark-text-color-icon]')?.closest<HTMLElement>('[data-item-type="button"]')?.click();
  }
  setTextColor(editor: Editor, color: string | null) {
    if (editor.wysimark.readOnly) return;
    color = color?.toUpperCase() || null;
    this.settings.defaultTextColor = color;
    void this.saveData(this.settings);
    applyTextColor(editor, color);
  }
  async activateBloView(): Promise<void> {
    const { workspace } = this.app;
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && isDrawingFile(this.app, activeFile)) {
      await openDrawing(this.app, activeFile);
      return;
    }
    if (activeFile && this.settings.restrictExistingBloTabs && !this.isFileInEditingScope(activeFile)) {
      await this.enforceEditingScope(workspace.activeLeaf ?? undefined);
      return;
    }
    let leaf: WorkspaceLeaf | null = null;

    const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_BLO);
    if (existingLeaves.length > 0) {
      leaf = existingLeaves[0];
    } else {
      leaf = workspace.getLeaf('tab');
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_BLO, active: true });
      }
    }

    if (leaf) {
      void workspace.revealLeaf(leaf);

      // Load the current active file
      if (activeFile && activeFile.extension === 'md') {
        const view = leaf.view as BloView;
        if (view && view.loadNote) {
          await view.loadNote(activeFile);
        }
      }
    }
  }

}
