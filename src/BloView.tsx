import type BloEditorPlugin from './main';
import { ui } from "./wysimark/utils/translations"
import { FileView, WorkspaceLeaf, TFile, normalizePath, Plugin, App, MarkdownRenderer, Component, Scope, setIcon, Notice } from 'obsidian';
import { Editor, Node, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Editable, useEditor, OnImageSaveHandler } from './wysimark/entry';
import { isWikiEmbedUrl, wikiEmbedSpecFromUrl, wikiLinkTarget } from './wysimark/convert/obsidian-links';
import { getLineEnding, withLineEnding, LineEnding } from './wysimark/convert/line-endings';
import { handleScopedHotkey } from './wysimark/entry/scoped-hotkeys';
import { selectBoundaryFromPointer } from './blocks/boundary-pointer';
import { selectDocumentEndFromPointer } from './blocks/document-end-pointer';
import { insertDocumentStartParagraph } from './blocks/document-start';
import { rootCache } from './blocks/model';
import { FindBar } from './search/FindBar';
import { DocumentTitle } from './DocumentTitle';
import { isMemoPanelDocument, popoutDocument } from './memo-panel';
import { DrawingEmbed, drawingViewType, insertDrawing, isDrawingFile } from './drawings';
import { VideoEmbed, VIDEO_FILE_PATTERN } from './VideoEmbed';
import { attachmentPath, isAttachmentPath } from './attachments';
import type { EditorSettings } from './settings';
import { watchAttachments } from './attachment-cleanup';
import { handleMediaTransfer, handleVaultMediaTransfer } from './media-paste';
import { normalizeVaultLinkInput, resolveVaultReference, vaultMediaUrl, vaultTransferReferences } from './vault-media';
import { watchRemoteImages } from './remote-images';
import { downloadAttachment } from './remote-attachments';
import { PdfExportModal } from './pdf-export';
import type { Menu } from 'obsidian';
import { CacheProvider } from '@emotion/react';

export const VIEW_TYPE_BLO = 'blo-view';

// Frontmatter regex: matches YAML frontmatter at the start of the file
const FRONTMATTER_REGEX = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);

/**
 * Extract frontmatter from markdown content
 * Returns the frontmatter (including delimiters) and the body separately
 */
function extractFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(FRONTMATTER_REGEX);
  if (match) {
    return {
      frontmatter: match[0],
      body: content.slice(match[0].length),
    };
  }
  return {
    frontmatter: '',
    body: content,
  };
}

/**
 * Combine frontmatter and body back into full content
 */
function combineFrontmatter(frontmatter: string, body: string): string {
  if (!frontmatter) {
    return body;
  }
  return frontmatter + body;
}

// Empty state component when no file is selected
function EmptyState({loading=false,fileName}:{loading?:boolean;fileName?:string}) {
  const icon=React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(()=>{if(icon.current)setIcon(icon.current,'file-text');},[]);
  return (
    <div className="wysimark-empty-state" role={loading?'status':undefined} aria-live={loading?'polite':undefined}>
      <div ref={icon} className="wysimark-empty-state-icon" aria-hidden="true" />
      <div className="wysimark-empty-state-text">{loading
        ?fileName?ui('正在打开「{name}」…',{name:fileName}):ui('正在打开笔记…')
        :ui("Open a Markdown file to edit")}</div>
      {!loading&&<div className="wysimark-empty-state-hint">{ui("Select a .md file from the file explorer")}</div>}
    </div>
  );
}

function linkPathFromInternalTarget(target: string): string {
  const hashIndex = target.indexOf('#');
  return (hashIndex >= 0 ? target.slice(0, hashIndex) : target).trim();
}

function InternalLinkPreview({
  app,
  sourcePath,
  target,
}: {
  app: App;
  sourcePath: string;
  target: string;
}) {
  const previewRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    const previewEl = previewRef.current;
    if (!previewEl) return;

    // Use a short-lived Component as the render lifecycle owner instead of the
    // plugin instance, so the rendered markdown's children are cleaned up when
    // this preview unmounts.
    const component = new Component();
    component.load();

    previewEl.empty();
    previewEl.setText(ui("Loading preview..."));

    const render = async () => {
      const linkPath = linkPathFromInternalTarget(target);
      const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
      const targetFile = linkPath
        ? app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath)
        : sourceFile;

      if (!(targetFile instanceof TFile)) {
        if (!cancelled) previewEl.setText(ui('未找到：{target}',{target}));
        return;
      }

      if (IMAGE_EXTENSIONS.has(targetFile.extension.toLowerCase())) {
        if (cancelled) return;
        previewEl.empty();
        const image = previewEl.createEl('img', {
          attr: { src: app.vault.getResourcePath(targetFile), alt: targetFile.basename },
        });
        image.setCssStyles({ display: 'block', maxWidth: '100%', height: 'auto' });
        return;
      }

      if (targetFile.extension.toLowerCase() !== 'md') {
        if (!cancelled) previewEl.setText(ui('无法预览：{target}',{target:targetFile.path}));
        return;
      }

      const markdown = await app.vault.cachedRead(targetFile);
      if (!markdown.trim()) {
        if (!cancelled) previewEl.setText(ui("Empty note"));
        return;
      }
      if (cancelled) return;

      previewEl.empty();
      await MarkdownRenderer.render(app, markdown, previewEl, targetFile.path, component);
    };

    void render();

    return () => {
      cancelled = true;
      component.unload();
      previewEl.empty();
    };
  }, [app, sourcePath, target]);

  return <div ref={previewRef} />;
}

function InternalEmbedView({
  app,
  sourcePath,
  spec,
}: {
  app: App;
  sourcePath: string;
  spec: string;
}) {
  const target = wikiLinkTarget(spec);
  const normalizedTarget = normalizePath(target);
  const exactTarget = app.vault.getAbstractFileByPath(normalizedTarget);
  const targetFile = exactTarget instanceof TFile
    ? exactTarget
    : app.metadataCache.getFirstLinkpathDest(target, sourcePath);
  const targetExtension = normalizedTarget.includes('.')
    ? normalizedTarget.slice(normalizedTarget.lastIndexOf('.') + 1).toLowerCase()
    : '';
  const targetsImage = IMAGE_EXTENSIONS.has(targetExtension);
  const imageFile = targetFile instanceof TFile && IMAGE_EXTENSIONS.has(targetFile.extension.toLowerCase())
    ? targetFile
    : null;
  const embedRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (imageFile || targetsImage || targetFile instanceof TFile && (isDrawingFile(app, targetFile) || VIDEO_FILE_PATTERN.test(targetFile.path))) return;
    let cancelled = false;
    const embedEl = embedRef.current;
    if (!embedEl) return;

    // Use a short-lived Component as the render lifecycle owner so the
    // embedded note's children are cleaned up when this embed unmounts.
    const component = new Component();
    component.load();

    embedEl.empty();

    // Render the literal `![[spec]]` so Obsidian resolves the embed itself
    // (note transclusion, image, PDF, etc.) using the source file's context.
    void MarkdownRenderer.render(
      app,
      `![[${spec}]]`,
      embedEl,
      sourcePath,
      component
    ).then(() => {
      if (cancelled) embedEl.empty();
    });

    return () => {
      cancelled = true;
      component.unload();
      embedEl.empty();
    };
  }, [app, imageFile, targetFile, sourcePath, spec, targetsImage]);

  if (imageFile) {
    return (
      <img
        src={app.vault.getResourcePath(imageFile)}
        alt={imageFile.basename}
        className="wysimark-internal-embed-image"
        data-blo-image
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      />
    );
  }

  if (targetsImage) {
    return <span className="wysimark-internal-embed-missing">Image not found: {target}</span>;
  }

  if (targetFile instanceof TFile && isDrawingFile(app, targetFile)) {
    return <DrawingEmbed app={app} file={targetFile} spec={spec} sourcePath={sourcePath} />;
  }
  if (targetFile instanceof TFile && VIDEO_FILE_PATTERN.test(targetFile.path)) {
    return <VideoEmbed app={app} file={targetFile} />;
  }
  return <div ref={embedRef} className="wysimark-internal-embed" />;
}

function MermaidPreview({
  app,
  sourcePath,
  code,
}: {
  app: App;
  sourcePath: string;
  code: string;
}) {
  const previewRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    const previewEl = previewRef.current;
    if (!previewEl) return;

    const component = new Component();
    component.load();
    previewEl.empty();
    previewEl.setText(ui("Rendering diagram..."));

    void MarkdownRenderer.render(
      app,
      `\`\`\`mermaid\n${code}\n\`\`\``,
      previewEl,
      sourcePath,
      component
    ).then(() => {
      if (cancelled) previewEl.empty();
    }).catch((error: unknown) => {
      if (!cancelled) {
        previewEl.setText(error instanceof Error ? error.message : ui("Invalid Mermaid diagram"));
      }
    });

    return () => {
      cancelled = true;
      component.unload();
      previewEl.empty();
    };
  }, [app, code, sourcePath]);

  return <div ref={previewRef} className="wysimark-mermaid-preview" />;
}

// React component for the editor
function KnowledgeSpaceEditorComponent({
  initialValue,
  onChange,
  plugin,
  file,
  fileName,
  onReload,
  onImageSave,
  connectEditor,
  readOnly,
  memoPanel,
}: {
  initialValue: string;
  onChange: (markdown: string) => void;
  plugin: BloEditorPlugin;
  file: TFile;
  fileName: string;
  onReload: () => void;
  onImageSave?: OnImageSaveHandler;
  connectEditor: (editor: Editor) => () => void;
  readOnly: boolean;
  memoPanel: boolean;
}) {
  const openInternalLink = React.useCallback(async (target: string, newLeaf = false) => {
    const normalized = normalizeVaultLinkInput(plugin.app, target).target;
    if (/^obsidian:\/\//i.test(normalized)) { window.open(normalized); return; }
    await plugin.app.workspace.openLinkText(normalized, file.path, newLeaf, {
      active: true,
    });
  }, [file.path, plugin.app.workspace]);

  const renderInternalLinkPreview = React.useCallback((target: string) => {
    return (
      <InternalLinkPreview
        app={plugin.app}
        sourcePath={file.path}
        target={target}
      />
    );
  }, [file.path, plugin.app]);

  const renderInternalEmbed = React.useCallback((spec: string) => {
    return (
      <InternalEmbedView
        app={plugin.app}
        sourcePath={file.path}
        spec={spec}
      />
    );
  }, [file.path, plugin.app]);

  const renderMermaidPreview = React.useCallback((code: string) => {
    return <MermaidPreview app={plugin.app} sourcePath={file.path} code={code} />;
  }, [file.path, plugin.app]);

  const getVaultImagePaths = React.useCallback(() => {
    return plugin.app.vault
      .getFiles()
      .filter((vaultFile) => IMAGE_EXTENSIONS.has(vaultFile.extension.toLowerCase()))
      .map((vaultFile) => vaultFile.path)
      .sort((a, b) => a.localeCompare(b));
  }, [plugin.app.vault]);

  const getVaultFilePaths = React.useCallback(() => {
    return plugin.app.vault
      .getFiles()
      .map((vaultFile) => vaultFile.path)
      .sort((a, b) => a.localeCompare(b));
  }, [plugin.app.vault]);

  const editor = useEditor({
    openInternalLink,
    renderInternalLinkPreview,
    renderInternalEmbed,
    renderMermaidPreview,
  });
  editor.wysimark.readOnly = readOnly;
  editor.wysimark.toolbarPreferences = plugin.toolbarPreferences;
  editor.wysimark.integrationPreferences = plugin.integrationPreferences;
  editor.wysimark.normalizeInternalLink = value => normalizeVaultLinkInput(plugin.app, value);
  editor.wysimark.downloadAttachment = downloadAttachment;
  editor.wysimark.resolveInternalMedia = target => {
    const reference = resolveVaultReference(plugin.app, file.path, target);
    return reference ? vaultMediaUrl(plugin.app, file.path, reference) : undefined;
  };
  editor.wysimark.getReferencedMedia = url => {
    const target = isWikiEmbedUrl(url) ? wikiLinkTarget(wikiEmbedSpecFromUrl(url)) : url;
    const reference = resolveVaultReference(plugin.app, file.path, target);
    if (!reference || isAttachmentPath(reference.file.path, plugin.settings.attachmentFolder)) return;
    return { target: reference.file.path, name: reference.file.name, path: reference.file.path };
  };
  editor.wysimark.isDrawingEmbed = (url: string) => {
    if (!isWikiEmbedUrl(url)) return false;
    const target = wikiLinkTarget(wikiEmbedSpecFromUrl(url)).split('#')[0];
    const exact = plugin.app.vault.getAbstractFileByPath(normalizePath(target));
    const drawing = exact instanceof TFile ? exact : plugin.app.metadataCache.getFirstLinkpathDest(target, file.path);
    return drawing instanceof TFile && isDrawingFile(plugin.app, drawing);
  };
  // Glimmer Memo's popout already shows the file name and owns renaming there.
  editor.wysimark.documentTitle = memoPanel ? undefined : <DocumentTitle app={plugin.app} file={file} save={async()=>{await editor.wysimark.save?.()}}
    onEnterEnd={readOnly ? undefined : () => insertDocumentStartParagraph(editor)} />;
  editor.wysimark.resolveImageUrl = (url: string) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) return url;
    let decoded = url;
    try { decoded = decodeURIComponent(url); } catch { /* Preserve literal filename. */ }
    const image = plugin.app.metadataCache.getFirstLinkpathDest(decoded, file.path);
    return image instanceof TFile ? plugin.app.vault.getResourcePath(image) : url;
  };
  React.useEffect(() => connectEditor(editor), [connectEditor, editor]);
  // Keep the controlled Markdown value current when the view rerenders.
  const value = initialValue;

  const handleChange = React.useCallback((markdown: string) => {
    onChange(markdown);
  }, [onChange]);

  return (
    <div className="wysimark-editor-wrapper"
      onMouseDownCapture={event => { if (!readOnly) selectBoundaryFromPointer(editor, event); }}
      // Slate's later click handler selects void image blocks even when the
      // preceding mousedown was handled in the right gutter.
      onClickCapture={event => { if (!readOnly) selectBoundaryFromPointer(editor, event); }}>
      <div className="wysimark-editor-container">
        <Editable
          editor={editor}
          readOnly={readOnly}
          value={value}
          onChange={handleChange}
          placeholder={ui("开始输入…")}
          className="wysimark-editor"
          style={{}}
          onImageSave={onImageSave}
          getVaultImagePaths={getVaultImagePaths}
          getVaultFilePaths={getVaultFilePaths}
        />
      </div>
    </div>
  );
}

// Main container component
function KnowledgeSpaceContainer({
  file,
  loading,
  openingFileName,
  content,
  onChange,
  onReload,
  onImageSave,
  reloadKey,
  plugin,
  connectEditor,
  readOnly,
  memoPanel,
}: {
  file: TFile | null;
  loading: boolean;
  openingFileName?: string;
  content: string;
  onChange: (markdown: string) => void;
  onReload: () => void;
  onImageSave?: OnImageSaveHandler;
  reloadKey: number;
  plugin: BloEditorPlugin;
  connectEditor: (editor: Editor) => () => void;
  readOnly: boolean;
  memoPanel: boolean;
}) {
  if (!file) {
    return <EmptyState loading={loading} fileName={openingFileName} />;
  }

  return (
    <KnowledgeSpaceEditorComponent
      key={`${file.path}-${reloadKey}`}
      initialValue={content}
      onChange={onChange}
      plugin={plugin}
      connectEditor={connectEditor}
      file={file}
      fileName={file.basename}
      onReload={onReload}
      onImageSave={onImageSave}
      readOnly={readOnly}
      memoPanel={memoPanel}
    />
  );
}

export class BloView extends FileView {
  plugin: BloEditorPlugin;
  root: Root | null = null;
  currentFile: TFile | null = null;
  private openingFile: TFile | null = null;
  private stateReady = false;
  fileContent: string = '';
  private frontmatter: string = '';  // Store frontmatter separately
  private bodyContent: string = '';  // Store body content (without frontmatter)
  private lineEnding: LineEnding = '\n';
  private saveTimeout: number | null = null;
  private viewRedirect: number | null = null;
  private isDirty: boolean = false;
  private reactContainer: HTMLElement | null = null;
  private reloadKey: number = 0;  // Used to force React component remount on reload
  editor: Editor | null = null;
  readOnly = false;
  /** True while this view lives in Glimmer Memo's quick memo popout. */
  memoPanel = false;
  private memoPanelObserver: MutationObserver | null = null;
  private windowFocusHandler: (() => void) | null = null;
  private windowFocusFrame: number | null = null;
  private lastEditorMarkdown = '';
  private modeAction: HTMLElement;
  private findBar: FindBar | null = null;
  showSearch(replace = false) { this.findBar?.open(replace); }

  private connectEditor = (editor: Editor) => {
    this.editor = editor;
    const stopWatchingAttachments = this.currentFile ? watchAttachments(this.app, this.currentFile, editor,
      () => (this.plugin as Plugin & { settings: EditorSettings }).settings) : () => {};
    this.findBar?.attach();
    this.findBar?.refresh();
    this.lastEditorMarkdown = editor.getMarkdown();
    editor.wysimark.save = () => this.saveFile();
    editor.wysimark.openSearch = replace => this.showSearch(replace);
    editor.wysimark.toggleReading = () => this.toggleReading();
    editor.wysimark.openTextColor = () => (this.plugin as any).openTextColor(editor);
    editor.wysimark.insertDrawing = async () => {
      if (!this.plugin.settings.enableDrawings) { new Notice(ui('请先在设置中启用画板')); return; }
      const file = this.currentFile;
      if (file) await insertDrawing(this.app, file, editor, () => this.editor === editor && this.currentFile === file,
        (this.plugin as Plugin & { settings: EditorSettings }).settings.attachmentFolder);
    };
    editor.wysimark.getTextColor = () => (this.plugin as any).settings.defaultTextColor;
    editor.wysimark.setTextColor = color => (this.plugin as any).setTextColor(editor, color);
    editor.wysimark.getTableDefaults = () => (this.plugin as any).settings.tableDefaults;
    editor.wysimark.setTableDefaults = defaults => {
      (this.plugin as any).settings.tableDefaults = defaults;
      void this.plugin.saveData((this.plugin as any).settings);
    };
    // A popout such as the quick memo panel focuses its window, not the editor,
    // so the caret must be placed here for typing to start right away.
    this.queuePanelFocus();
    const source = this.currentFile;
    editor.wysimark.isCurrentDocument = () => this.editor === editor && this.currentFile === source && !this.readOnly;
    const stopRemoteImages = source ? watchRemoteImages(this.app, source.path, editor, () => {
      const folder = this.plugin.settings.attachmentFolder;
      return file => this.saveAttachmentFile(file, source.path, folder);
    }, () => this.editor === editor && this.currentFile === source && !this.readOnly && this.app.workspace.activeLeaf === this.leaf) : () => {};
    return () => {
      stopRemoteImages();
      stopWatchingAttachments();
      if (this.editor === editor) this.editor = null;
    };
  };

  constructor(leaf: WorkspaceLeaf, plugin: BloEditorPlugin) {
    super(leaf);
    this.allowNoFile = true;
    this.plugin = plugin;
    this.modeAction = this.addAction('book-open', ui("切换到阅读模式（Ctrl+Alt+P）"), () => { void this.toggleReading(); });
    this.addAction('refresh-cw', ui("从文件重新载入"), () => { void this.reloadFile(); });
    const pdfAction = this.addAction('file-down', ui('导出 PDF'), () => {
      if (this.currentFile && this.editor) new PdfExportModal(this).open();
    });
    this.modeAction.after(pdfAction);
    this.scope = new Scope(this.app.scope);
    this.scope.register(null, null, (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && ['f','h'].includes(event.key.toLowerCase())) {
        event.preventDefault(); this.showSearch(event.key.toLowerCase() === 'h'); return false;
      }
      const target = event.target as HTMLElement | null;
      if (!this.editor || !target?.closest?.('[data-slate-editor="true"]') ||
        !this.reactContainer?.contains(target)) return;
      if (this.readOnly && !((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'p')) return;
      if (handleScopedHotkey(this.editor, event)) return false;
    });
  }

  getViewType(): string {
    return VIEW_TYPE_BLO;
  }

  /** Obsidian focuses a view through this hook; keep the editor usable. */
  focus(): void {
    if (popoutDocument(this.leaf)) this.queuePanelFocus();
    else this.focusEditor();
  }

  private queuePanelFocus() {
    const win = popoutDocument(this.leaf)?.defaultView;
    if (!win || this.windowFocusFrame !== null) return;
    this.windowFocusFrame = win.requestAnimationFrame(() => {
      this.windowFocusFrame = null;
      this.focusPanelEditor();
    });
  }

  /** Put the caret back into the note when its popout window becomes active. */
  private focusPanelEditor() {
    const doc = popoutDocument(this.leaf);
    if (!doc?.hasFocus()) return;
    if (this.app.workspace.activeLeaf !== this.leaf) return;
    const active = doc.activeElement;
    if (active?.closest('input, textarea, select, .wysimark-overlay, .modal-container') &&
      !active.closest('[data-slate-editor="true"]')) return;
    this.focusEditor();
  }

  private focusEditor() {
    const editor = this.editor;
    if (!editor || this.readOnly) return;
    try {
      if (!editor.selection) Transforms.select(editor, Editor.end(editor, []));
      ReactEditor.focus(editor);
    } catch { /* The editable may still be mounting. */ }
  }

  getDisplayText(): string {
    return this.currentFile ? this.currentFile.basename : this.plugin.manifest.name;
  }

  getIcon(): string {
    return 'pencil';
  }

  async onOpen(): Promise<void> {
    await super.onOpen();
    // Get the content container
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('wysimark-container');
    const transfer = (event: ClipboardEvent | DragEvent) => {
      const editor = this.editor, file = this.currentFile;
      if (!editor || !file || this.readOnly || !(event.target as HTMLElement).closest('[data-slate-editor="true"]')) return;
      if (handleVaultMediaTransfer(this.app, file.path, editor, event,
        () => this.editor === editor && this.currentFile === file && !this.readOnly)) return;
      handleMediaTransfer(editor, event, this.handleImageSave,
        () => this.editor === editor && this.currentFile === file && !this.readOnly);
    };
    this.registerDomEvent(contentEl, 'paste', transfer, true);
    this.registerDomEvent(contentEl, 'drop', transfer, true);
    this.registerDomEvent(contentEl, 'dragover', event => {
      if (!this.readOnly && event.dataTransfer && (event.dataTransfer.types.includes('Files') ||
        this.currentFile && vaultTransferReferences(this.app, this.currentFile.path, event.dataTransfer, true).length > 0) &&
        (event.target as HTMLElement).closest('[data-slate-editor="true"]')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    }, true);
    let bottomClick = false;
    this.registerDomEvent(contentEl, 'mousedown', event => {
      bottomClick = !!this.editor && !this.readOnly && selectDocumentEndFromPointer(this.editor, event, contentEl);
    }, true);
    this.registerDomEvent(contentEl, 'click', event => {
      if (bottomClick) { event.preventDefault(); event.stopPropagation(); bottomClick = false; }
    }, true);
    this.findBar = new FindBar(contentEl, () => this.editor, () => this.readOnly);

    // Create a div for React to render into
    this.reactContainer = contentEl.createDiv({ cls: 'wysimark-react-root' });

    // Create React root
    this.root = createRoot(this.reactContainer);
    this.watchMemoPanel();
    const panelWindow = popoutDocument(this.leaf)?.defaultView;
    if (panelWindow) {
      this.windowFocusHandler = () => this.queuePanelFocus();
      panelWindow.addEventListener('focus', this.windowFocusHandler);
      this.registerEvent(this.app.workspace.on('active-leaf-change', leaf => {
        if (leaf === this.leaf) this.queuePanelFocus();
      }));
    }
    this.renderEditor();
  }

  async onClose() {
    if (this.viewRedirect !== null) {
      window.clearTimeout(this.viewRedirect);
      this.viewRedirect = null;
    }
    this.memoPanelObserver?.disconnect();
    this.memoPanelObserver = null;
    if (this.windowFocusFrame !== null) {
      popoutDocument(this.leaf)?.defaultView?.cancelAnimationFrame(this.windowFocusFrame);
      this.windowFocusFrame = null;
    }
    if (this.windowFocusHandler) {
      popoutDocument(this.leaf)?.defaultView?.removeEventListener('focus', this.windowFocusHandler);
      this.windowFocusHandler = null;
    }
    this.findBar?.destroy(); this.findBar = null;
    // Clear any pending save timeout
    if (this.saveTimeout) {
      window.clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Save before closing
    await this.saveFile();

    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    await super.onClose();
  }

  async onLoadFile(file: TFile) { await this.loadContent(file); }
  async onUnloadFile(_file: TFile) { await this.saveFile(); this.currentFile = null; this.renderEditor(); }
  /** Glimmer Memo asks the hosted view to flush before it hides or closes the popout. */
  async save(): Promise<void> { await this.saveFile(); }
  canAcceptExtension(extension: string) { return extension === 'md'; }
  onPaneMenu(menu: Menu, source: string) {
    super.onPaneMenu(menu, source);
    if (this.currentFile) menu.addItem(item => item.setTitle(ui('导出 PDF')).setIcon('file-down').onClick(() => new PdfExportModal(this).open()));
  }
  async loadNote(file: TFile) { await this.leaf.setViewState({ type: VIEW_TYPE_BLO, state: { file: file.path }, active: true }); }
  getMode() { return this.readOnly ? 'preview' : 'source'; }
  async setState(state: { file?: string; mode?: string }, result: { history: boolean }) {
    if (this.viewRedirect !== null) {
      window.clearTimeout(this.viewRedirect);
      this.viewRedirect = null;
    }
    // Obsidian reuses a FileView that accepts .md, bypassing the native
    // Markdown-to-Blo handler for drawings and files outside the editing scope.
    const file = state.file ? this.app.vault.getAbstractFileByPath(state.file) : null;
    this.stateReady = true;
    this.openingFile = file instanceof TFile && file.path !== this.currentFile?.path ? file : null;
    if (!this.currentFile) this.renderEditor();
    if (file instanceof TFile && (isDrawingFile(this.app, file) || (this.plugin.settings.restrictExistingBloTabs && !this.plugin.isFileInEditingScope(file) && !this.plugin.isMemoPanelLeaf(this.leaf, file) && !this.plugin.isPdfExportLeaf(this.leaf)))) {
      // Finish Obsidian's current view assignment first; a nested switch is
      // otherwise overwritten when the outer setViewState call completes.
      this.viewRedirect = window.setTimeout(() => {
        this.viewRedirect = null;
        if (this.leaf.view !== this) return;
        const type = isDrawingFile(this.app, file) ? drawingViewType(this.app) : 'markdown';
        void this.leaf.setViewState({ type, state, active: this.leaf === this.app.workspace.activeLeaf })
          .catch(error => console.error('Blo Editor: could not open scoped file view', error));
      }, 0);
      return;
    }
    this.readOnly = state.mode === 'preview';
    await super.setState(state, result);
    this.openingFile = null;
    this.updateModeUI(); this.renderEditor();
  }
  private updateModeUI() {
    this.findBar?.refresh();
    this.contentEl.toggleClass('wysimark-reading', this.readOnly);
    setIcon(this.modeAction, this.readOnly ? 'pencil' : 'book-open');
    this.modeAction.setAttribute('aria-label', this.readOnly ? ui("返回富文本编辑（Ctrl+Alt+P）") : ui("切换到阅读模式（Ctrl+Alt+P）"));
  }
  async toggleReading() {
    await this.saveFile();
    this.readOnly = !this.readOnly; this.updateModeUI(); this.renderEditor();
    this.app.workspace.requestSaveLayout();
  }
  setEphemeralState(state: { subpath?: string; line?: number }) {
    super.setEphemeralState(state);
    if (!state.subpath?.startsWith('#')) {
      if (typeof state.line === 'number') this.navigateToHeading('', state.line);
      return;
    }
    const heading = decodeURIComponent(state.subpath.slice(1)).trim();
    this.navigateToHeading(heading, state.line);
  }
  navigateToHeading(heading: string, line?: number, headingIndex?: number) {
    const scroll = (attempt = 0) => {
      if (!this.editor) { if (attempt < 20) window.setTimeout(() => scroll(attempt + 1), 20); return; }
      const headings = rootCache(this.editor).headings;
      const cache = this.currentFile ? this.app.metadataCache.getFileCache(this.currentFile)?.headings : undefined;
      const index = typeof line === 'number' ? cache?.findIndex(entry => entry.position.start.line === line) ?? -1 : -1;
      const sourceHeadings=cache?.length===headings.length?headings:headings.filter(entry=>entry.listIndex===undefined);
      const target=typeof headingIndex==='number'?headings[headingIndex]:index>=0?sourceHeadings[index]:headings.find(entry=>Node.string(entry.node).trim()===heading);
      const match=target?[target.node,ReactEditor.findPath(this.editor,target.node)] as const:undefined;
      if (match) {
        const target = ReactEditor.toDOMNode(this.editor, match[0]);
        const toolbar = this.containerEl.querySelector<HTMLElement>('[data-wysimark-toolbar]');
        // Native scrollIntoView accounts for scroll-margin in each scroll container.
        target.style.scrollMarginTop = `${toolbar ? toolbar.getBoundingClientRect().height + 10 + 16 : 16}px`;
        if (!this.readOnly) {
          Transforms.select(this.editor, Editor.start(this.editor, match[1]));
          ReactEditor.focus(this.editor);
        }
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
    };
    scroll();
  }

  getState() {
    return {
      ...super.getState(),
      file: this.currentFile?.path,
      mode: this.getMode(),
    };
  }

  private async loadContent(file: TFile) {
    // Don't reload if same file
    if (this.currentFile?.path === file.path) {
      return;
    }
    this.openingFile = file;
    this.stateReady = true;
    if (!this.currentFile) this.renderEditor();

    // Save previous file before switching
    if (this.currentFile && this.isDirty) {
      await this.saveFile();
    }

    this.currentFile = file;
    const rawContent = await this.app.vault.cachedRead(file);

    // Extract frontmatter and body
    const { frontmatter, body } = extractFrontmatter(rawContent);
    this.frontmatter = frontmatter;
    this.bodyContent = body;
    this.fileContent = rawContent;
    this.lineEnding = getLineEnding(rawContent);
    this.isDirty = false;

    this.openingFile = null;
    this.renderEditor();
  }

  // Reload the current file from Obsidian (discard any unsaved changes)
  async reloadFile() {
    if (!this.currentFile) {
      return;
    }

    // Clear any pending save timeout
    if (this.saveTimeout) {
      window.clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Read fresh content from disk
    const rawContent = await this.app.vault.read(this.currentFile);

    // Extract frontmatter and body
    const { frontmatter, body } = extractFrontmatter(rawContent);
    this.frontmatter = frontmatter;
    this.bodyContent = body;
    this.fileContent = rawContent;
    this.lineEnding = getLineEnding(rawContent);
    this.isDirty = false;

    // Increment reloadKey to force React component remount
    this.reloadKey++;

    this.renderEditor();
  }

  async saveFile(): Promise<void> {
    if (this.editor && !this.readOnly) {
      const markdown = this.editor.getMarkdown();
      if (markdown !== this.lastEditorMarkdown) { this.lastEditorMarkdown = markdown; this.handleChange(markdown); }
    }
    if (this.currentFile && this.isDirty) {
      const file = this.currentFile, content = this.fileContent, children = this.editor?.children;
      await this.app.vault.process(file, () => content);
      // Edits made while a write is in flight still need their own save.
      if (this.currentFile === file) this.isDirty = this.fileContent !== content || this.editor?.children !== children;
    }
  }

  handleChange = (markdown: string) => {
    this.findBar?.refresh();
    if (this.readOnly) return;
    markdown = withLineEnding(markdown, this.lineEnding);
    if (markdown === this.bodyContent) return;
    // Update body content and combine with frontmatter for full file content
    this.bodyContent = markdown;
    this.fileContent = combineFrontmatter(this.frontmatter, markdown);
    this.isDirty = true;

    // Auto-save with debounce (1 second delay)
    if (this.saveTimeout) window.clearTimeout(this.saveTimeout);
    this.saveTimeout = window.setTimeout(() => {
      this.saveTimeout = null;
      void this.saveFile();
    }, 1000);
  }

  /**
   * Handle saving an image file to the vault
   * @param file - The image file to save
   * @param path - The path within the vault to save the file
   * @returns The URL to use for displaying the image in the editor
   */
  handleImageSave: OnImageSaveHandler = (file: File, path: string) =>
    this.saveAttachmentFile(file, this.currentFile?.path, this.plugin.settings.attachmentFolder);

  private saveAttachmentFile = async (file: File, sourcePath: string | undefined, folder: string): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hash = Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, '0')).join('');
    const normalizedPath = await attachmentPath(this.app, folder, hash.slice(0, 20) + '-' + file.name);

    // Convert File to ArrayBuffer

    // Check if file already exists
    let savedFile: TFile;
    const existingFile = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (existingFile instanceof TFile) {
      throw new Error('Attachment path already exists; original image preserved.');
    } else {
      // Create new file
      savedFile = await this.app.vault.createBinary(normalizedPath, arrayBuffer);
    }

    // Return the Obsidian resource URL for displaying in the editor
    // This URL format works within Obsidian's app environment
    const sourceDir = sourcePath?.split('/').slice(0, -1) ?? [];
    const targetParts = savedFile.path.split('/');
    while (sourceDir.length && targetParts.length && sourceDir[0] === targetParts[0]) {
      sourceDir.shift(); targetParts.shift();
    }
    return encodeURI('../'.repeat(sourceDir.length) + targetParts.join('/'));
  }

  /**
   * Glimmer Memo marks its popout body when the window attaches, which can happen
   * after this view opens, so follow that class instead of sampling it once.
   * The plugin also watches new windows to adopt their initial Markdown view
   * after Glimmer Memo has attached its marker.
   */
  private watchMemoPanel() {
    const doc = this.containerEl.ownerDocument;
    if (this.memoPanelObserver || !doc.body) return;
    // Use the target window's constructor: a popout document is observed from
    // the main renderer, and that window may load its own globals.
    const Observer = doc.defaultView?.MutationObserver ?? (typeof MutationObserver === 'undefined' ? null : MutationObserver);
    if (!Observer) return;
    this.memoPanelObserver = new Observer(() => this.syncMemoPanel());
    this.memoPanelObserver.observe(doc.body, { attributes: true, attributeFilter: ['class'] });
  }

  private memoPanelState() {
    if (isMemoPanelDocument(this.containerEl.ownerDocument)) return true;
    return !!this.currentFile && this.plugin.isMemoPanelLeaf(this.leaf, this.currentFile);
  }

  private syncMemoPanel() {
    if (this.root && this.memoPanelState() !== this.memoPanel) this.renderEditor();
  }

  handleReload = () => {
    void this.reloadFile();
  }

  renderEditor() {
    if (!this.root) return;
    const memoPanel = this.memoPanelState();
    if (memoPanel !== this.memoPanel) {
      this.memoPanel = memoPanel;
      this.contentEl.toggleClass('blo-memo-panel', memoPanel);
    }

    this.root.render(
      <CacheProvider value={this.plugin.styleCache.forDocument(this.containerEl.ownerDocument)}>
      <KnowledgeSpaceContainer
        readOnly={this.readOnly}
        memoPanel={this.memoPanel}
        file={this.currentFile}
        loading={!this.stateReady||!!this.openingFile}
        openingFileName={this.openingFile?.basename}
        content={this.bodyContent}  // Pass only body content (without frontmatter)
        onChange={this.handleChange}
        onReload={this.handleReload}
        onImageSave={this.handleImageSave}
        reloadKey={this.reloadKey}
        plugin={this.plugin}
        connectEditor={this.connectEditor}
      />
      </CacheProvider>
    );
  }
}
