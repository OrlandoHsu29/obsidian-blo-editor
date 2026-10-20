import { isPathInEditingScope } from './editing-scope';
import { installImageViewerIntegration } from './image-viewer-integration';
import { ui } from "./wysimark/utils/translations"
import { createEditorStyleCache } from './style-cache';
import { installOutlineFilter } from './outline';
import { Plugin, WorkspaceLeaf, TFile, MarkdownView, setIcon, setTooltip } from 'obsidian';
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
import { ToolbarPreferences } from './toolbar-preferences';

export default class BloEditorPlugin extends Plugin {
  readonly styleCache=createEditorStyleCache();
  readonly toolbarPreferences = new ToolbarPreferences();
  settings: EditorSettings = { ...DEFAULT_SETTINGS };
  private nativeLeaves = new WeakSet<WorkspaceLeaf>();
  private openingLeaves = new WeakSet<WorkspaceLeaf>();
  async onload(): Promise<void> {
    await super.onload();
    this.register(()=>this.styleCache.sheet.flush());
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
    this.settings = Object.assign(this.settings, await this.loadData());
    this.toolbarPreferences.setHidden(Array.isArray(this.settings.hiddenToolbarButtons) ? this.settings.hiddenToolbarButtons : []);
    this.addSettingTab(new BloSettingsTab(this));
    installDrawingNavigation(this);
    installImageViewerIntegration(this);

    // Reuse Image Toolkit's viewer without intercepting Slate's single-click selection.
    const previewImage = (event: MouseEvent) => {
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
    this.addCommand({id:'clear-formatting',name:ui("清除文字样式"),checkCallback:checking=>{
      const view=this.app.workspace.getActiveViewOfType(BloView);if(!view?.editor||view.readOnly)return false;
      if(!checking)clearFormatting(view.editor);return true;
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
      const view = this.app.workspace.getActiveViewOfType(BloView);
      if (!view?.editor || !view.currentFile || view.readOnly) return false;
      if (!checking) void view.editor.wysimark.insertDrawing?.();
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
    this.app.workspace.onLayoutReady(() => {
      void this.enforceEditingScope();
      const leaf = this.app.workspace.activeLeaf;
      if (leaf?.view instanceof MarkdownView && leaf.view.file) void this.openRichByDefault(leaf, leaf.view.file);
    });
  }
  isFileInEditingScope(file: TFile): boolean {
    return file.extension === 'md' && isPathInEditingScope(file.path, this.settings.richEditingFolder);
  }
  async enforceEditingScope(onlyLeaf?: WorkspaceLeaf): Promise<void> {
    if (!this.settings.restrictExistingBloTabs) return;
    for (const leaf of onlyLeaf ? [onlyLeaf] : this.app.workspace.getLeavesOfType(VIEW_TYPE_BLO)) {
      const view = leaf.view;
      if (!(view instanceof BloView) || !view.currentFile || this.isFileInEditingScope(view.currentFile) || isDrawingFile(this.app, view.currentFile) || this.openingLeaves.has(leaf)) continue;
      const file = view.currentFile, mode = view.getMode();
      this.openingLeaves.add(leaf);
      try {
        await view.saveFile();
        if (!this.settings.restrictExistingBloTabs || leaf.view !== view || view.currentFile !== file || this.isFileInEditingScope(file)) continue;
        await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode }, active: leaf === this.app.workspace.activeLeaf });
      } finally { this.openingLeaves.delete(leaf); }
    }
  }
  private async openRichByDefault(leaf: WorkspaceLeaf, file: TFile) {
    if (isDrawingFile(this.app, file) || !this.settings.preferRichEditing || this.nativeLeaves.has(leaf) || this.openingLeaves.has(leaf) || !this.isFileInEditingScope(file) ||
      !(leaf.view instanceof MarkdownView) || leaf.view.file?.path !== file.path) return;
    const mode = leaf.view.getMode();
    this.openingLeaves.add(leaf);
    try {
      await leaf.view.save();
      if (!this.settings.preferRichEditing || !this.isFileInEditingScope(file) || isDrawingFile(this.app, file) || !(leaf.view instanceof MarkdownView) || leaf.view.file?.path !== file.path) return;
      await leaf.setViewState({ type: VIEW_TYPE_BLO, state: { file: file.path, mode }, active: true });
    } finally { this.openingLeaves.delete(leaf); }
  }

  onunload(): void {
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
