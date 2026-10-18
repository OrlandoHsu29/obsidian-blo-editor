import { ui } from "./wysimark/utils/translations"
import { FileView, WorkspaceLeaf, TFile, normalizePath, Plugin, App, MarkdownRenderer, Component, Scope, setIcon } from 'obsidian';
import { Editor, Node, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Editable, useEditor, OnImageSaveHandler } from './wysimark/entry';
import { wikiLinkTarget } from './wysimark/convert/obsidian-links';
import { getLineEnding, withLineEnding, LineEnding } from './wysimark/convert/line-endings';
import { handleScopedHotkey } from './wysimark/entry/scoped-hotkeys';
import { selectBoundaryFromPointer } from './blocks/boundary-pointer';
import { FindBar } from './search/FindBar';
import { DocumentTitle } from './DocumentTitle';
import { CacheProvider } from '@emotion/react';
import type { EmotionCache } from '@emotion/cache';

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
function EmptyState() {
  return (
    <div className="wysimark-empty-state">
      <div className="wysimark-empty-state-icon">📝</div>
      <div className="wysimark-empty-state-text">{ui("Open a Markdown file to edit")}</div>
      <div className="wysimark-empty-state-hint">{ui("Select a .md file from the file explorer")}</div>
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
    if (imageFile || targetsImage) return;
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
  }, [app, imageFile, sourcePath, spec, targetsImage]);

  if (imageFile) {
    return (
      <img
        src={app.vault.getResourcePath(imageFile)}
        alt={imageFile.basename}
        className="wysimark-internal-embed-image"
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      />
    );
  }

  if (targetsImage) {
    return <span className="wysimark-internal-embed-missing">Image not found: {target}</span>;
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
}: {
  initialValue: string;
  onChange: (markdown: string) => void;
  plugin: Plugin;
  file: TFile;
  fileName: string;
  onReload: () => void;
  onImageSave?: OnImageSaveHandler;
  connectEditor: (editor: Editor) => () => void;
  readOnly: boolean;
}) {
  const openInternalLink = React.useCallback(async (target: string) => {
    await plugin.app.workspace.openLinkText(target, file.path, false, {
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
  editor.wysimark.documentTitle = <DocumentTitle app={plugin.app} file={file} save={async()=>{await editor.wysimark.save?.()}} />;
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
    <div className="wysimark-editor-wrapper" onMouseDownCapture={event => { if (!readOnly) selectBoundaryFromPointer(editor, event); }}>
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
  content,
  onChange,
  onReload,
  onImageSave,
  reloadKey,
  plugin,
  connectEditor,
  readOnly,
}: {
  file: TFile | null;
  content: string;
  onChange: (markdown: string) => void;
  onReload: () => void;
  onImageSave?: OnImageSaveHandler;
  reloadKey: number;
  plugin: Plugin;
  connectEditor: (editor: Editor) => () => void;
  readOnly: boolean;
}) {
  if (!file) {
    return <EmptyState />;
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
    />
  );
}

export class BloView extends FileView {
  plugin: Plugin;
  root: Root | null = null;
  currentFile: TFile | null = null;
  fileContent: string = '';
  private frontmatter: string = '';  // Store frontmatter separately
  private bodyContent: string = '';  // Store body content (without frontmatter)
  private lineEnding: LineEnding = '\n';
  private saveTimeout: number | null = null;
  private isDirty: boolean = false;
  private reactContainer: HTMLElement | null = null;
  private reloadKey: number = 0;  // Used to force React component remount on reload
  editor: Editor | null = null;
  readOnly = false;
  private lastEditorMarkdown = '';
  private modeAction: HTMLElement;
  private findBar: FindBar | null = null;
  showSearch(replace = false) { this.findBar?.open(replace); }

  private connectEditor = (editor: Editor) => {
    this.editor = editor;
    this.findBar?.attach();
    this.findBar?.refresh();
    this.lastEditorMarkdown = editor.getMarkdown();
    editor.wysimark.save = () => this.saveFile();
    editor.wysimark.openSearch = replace => this.showSearch(replace);
    editor.wysimark.toggleReading = () => this.toggleReading();
    editor.wysimark.openTextColor = () => (this.plugin as any).openTextColor(editor);
    editor.wysimark.getTextColor = () => (this.plugin as any).settings.defaultTextColor;
    editor.wysimark.setTextColor = color => (this.plugin as any).setTextColor(editor, color);
    return () => {
      if (this.editor === editor) this.editor = null;
    };
  };

  constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
    super(leaf);
    this.allowNoFile = true;
    this.plugin = plugin;
    this.modeAction = this.addAction('book-open', ui("切换到阅读模式（Ctrl+Alt+P）"), () => { void this.toggleReading(); });
    this.addAction('refresh-cw', ui("从文件重新载入"), () => { void this.reloadFile(); });
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
    this.findBar = new FindBar(contentEl, () => this.editor, () => this.readOnly);

    // Create a div for React to render into
    this.reactContainer = contentEl.createDiv({ cls: 'wysimark-react-root' });

    // Create React root
    this.root = createRoot(this.reactContainer);
    this.renderEditor();
  }

  async onClose() {
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
  canAcceptExtension(extension: string) { return extension === 'md'; }
  async loadNote(file: TFile) { await this.leaf.setViewState({ type: VIEW_TYPE_BLO, state: { file: file.path }, active: true }); }
  getMode() { return this.readOnly ? 'preview' : 'source'; }
  async setState(state: { file?: string; mode?: string }, result: { history: boolean }) {
    this.readOnly = state.mode === 'preview';
    await super.setState(state, result);
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
  navigateToHeading(heading: string, line?: number) {
    const scroll = (attempt = 0) => {
      if (!this.editor) { if (attempt < 20) window.setTimeout(() => scroll(attempt + 1), 20); return; }
      const headings = Array.from(Node.elements(this.editor)).filter(([node]) => node.type === 'heading');
      const cache = this.currentFile ? this.app.metadataCache.getFileCache(this.currentFile)?.headings : undefined;
      const index = typeof line === 'number' ? cache?.findIndex(entry => entry.position.start.line === line) ?? -1 : -1;
      const match = index >= 0 ? headings[index] : headings.find(([node]) => Node.string(node).trim() === heading);
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
  handleImageSave: OnImageSaveHandler = async (file: File, path: string) => {
    // Normalize the path
    const arrayBuffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hash = Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, '0')).join('');
    const normalizedPath = normalizePath(await this.app.fileManager.getAvailablePathForAttachment(
      hash.slice(0, 20) + '-' + file.name, this.currentFile?.path
    ));

    // Create parent directories if they don't exist
    const parentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
    if (parentDir) {
      const existingFolder = this.app.vault.getAbstractFileByPath(parentDir);
      if (!existingFolder) {
        await this.app.vault.createFolder(parentDir);
      }
    }

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
    const sourceDir = this.currentFile?.path.split('/').slice(0, -1) ?? [];
    const targetParts = savedFile.path.split('/');
    while (sourceDir.length && targetParts.length && sourceDir[0] === targetParts[0]) {
      sourceDir.shift(); targetParts.shift();
    }
    return encodeURI('../'.repeat(sourceDir.length) + targetParts.join('/'));
  }

  handleReload = () => {
    void this.reloadFile();
  }

  renderEditor() {
    if (!this.root) return;

    this.root.render(
      <CacheProvider value={(this.plugin as Plugin & {styleCache:EmotionCache}).styleCache}>
      <KnowledgeSpaceContainer
        readOnly={this.readOnly}
        file={this.currentFile}
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
