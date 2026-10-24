import { Component, Modal, Notice, Platform, Setting } from 'obsidian';
import type { BloView } from './BloView';
import { ui } from './wysimark/utils/translations';

type PdfOptions = { paper: 'A4' | 'Letter' | 'A3'; landscape: boolean; margin: number; title: boolean; pages: boolean };
function pdfErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/data:[^\s'"]+/gi, '[embedded content]').slice(0, 300);
}
const PRINT_CSS = `
html,body{display:block!important;position:static!important;inset:auto!important;contain:none!important;content-visibility:visible!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;background:white!important;color:#222;color-scheme:light}
body{padding:0!important;margin:0!important;font-family:var(--font-text);font-size:16px}
.wysimark-container,.wysimark-editor{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;padding:0!important;margin:0!important;width:auto!important;max-width:none!important;display:block!important}
.wysimark-editor{padding-left:24px!important;box-sizing:border-box!important}
.ks-editor-chunk{display:block!important;content-visibility:visible!important;contain:none!important;height:auto!important;min-height:0!important;contain-intrinsic-size:none!important}
.ks-editor-chunk-leaf{margin:0!important;padding:0!important}
*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.wysimark-block{outline:none!important;box-shadow:none!important}
.wysimark-editor :is(h1,h2,h3,h4,h5,h6){break-after:avoid-page}
.wysimark-editor :is(tr,[data-blo-image],[data-blo-drawing]){break-inside:avoid}
.wysimark-editor :is(table,pre,[data-wysimark-code-block]){max-width:100%!important;width:auto;overflow:visible!important}
.wysimark-editor table{width:100%!important;table-layout:fixed!important}
.wysimark-editor :is(td,th){overflow-wrap:anywhere!important;min-width:0!important}
.wysimark-editor :is(pre,[data-wysimark-code-scroller],[data-wysimark-code-lines]){white-space:pre-wrap!important;overflow-wrap:anywhere!important;overflow:visible!important;max-height:none!important}
.wysimark-editor [data-wysimark-code-lines]>div{white-space:pre-wrap!important;height:auto!important;min-height:1.5em}
.wysimark-editor img,.wysimark-editor svg{max-width:100%}
[data-blo-image]{max-width:100%!important;outline:none!important;box-shadow:none!important}
[data-blo-image]>img{height:auto!important}
[data-blo-drawing]{max-width:100%!important;outline:none!important;box-shadow:none!important}
.blo-pdf-title{font-size:2em;font-weight:700;line-height:1.3;margin:0 0 1em;break-after:avoid-page}
`;

function stylesheetText(doc: Document): string {
  return Array.from(doc.styleSheets).map(sheet => {
    try { return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n'); }
    catch { return ''; }
  }).join('\n');
}

async function waitForDrawings(source: HTMLElement): Promise<void> {
  const ready = () => Array.from(source.querySelectorAll('.blo-drawing-content')).every(el => el.querySelector('svg,img,canvas'));
  if (ready()) return;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => { observer.disconnect(); window.clearTimeout(timeout); error ? reject(error) : resolve(); };
    const observer = new MutationObserver(() => { if (ready()) finish(); });
    const timeout = window.setTimeout(() => finish(new Error(ui('画板尚未加载完成，请稍后重试'))), 20000);
    observer.observe(source, { childList: true, subtree: true });
  });
}

async function dataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  let blob: Blob;
  try {
  const response = await fetch(src, { signal: controller.signal });
  if (!response.ok) throw new Error(ui('无法加载导出图片'));
  blob = await response.blob();
  } finally { window.clearTimeout(timeout); }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(ui('无法加载导出图片')));
    reader.readAsDataURL(blob);
  });
}

/** Snapshot the rendered document; no Slate operations or selection changes. */
export async function createPdfHtml(view: BloView, options: PdfOptions): Promise<string> {
  const source = view.contentEl.querySelector<HTMLElement>('[data-slate-editor="true"]');
  if (!source || !view.currentFile) throw new Error(ui('请先打开一篇笔记'));
  await waitForDrawings(source);
  const doc = source.ownerDocument;
  const clone = source.cloneNode(true) as HTMLElement;
  // Canvas pixels are not copied by cloneNode (SVG drawings already are).
  const canvases = Array.from(source.querySelectorAll('canvas'));
  clone.querySelectorAll('canvas').forEach((canvas, index) => {
    const image = doc.createElement('img');
    image.src = canvases[index].toDataURL('image/png');
    image.style.cssText = canvas.style.cssText;
    image.width = canvases[index].width;
    image.height = canvases[index].height;
    canvas.replaceWith(image);
  });
  // Number markers are interactive buttons in the editor, but are note content.
  clone.querySelectorAll('button.wysimark-list-number').forEach(button => {
    const marker = doc.createElement('span');
    marker.className = button.className;
    marker.style.cssText = (button as HTMLElement).style.cssText;
    marker.textContent = button.textContent;
    button.replaceWith(marker);
  });
  clone.querySelectorAll('button,script,style,iframe,object,embed,[data-wysimark-code-controls],.wysimark-block-handle,[data-slate-zero-width],[data-block-boundary="true"],.wysimark-overlay').forEach(el => {
    // Excalidraw embeds its handwriting fonts inside the SVG's stylesheet.
    if (el.tagName.toLowerCase() === 'style' && el.closest('svg')) return;
    el.remove();
  });
  // Image toolbar / resize controls are siblings of the actual image.
  clone.querySelectorAll('[data-blo-image]').forEach(el => {
    Array.from(el.children).forEach(child => { if (!['IMG', 'VIDEO'].includes(child.tagName)) child.remove(); });
  });
  for (const element of [clone, ...Array.from(clone.querySelectorAll('*'))]) {
    element.classList.remove('--selected', '--focused', '--dragging', 'is-selected');
    for (const attr of Array.from(element.attributes)) {
      if (/^on/i.test(attr.name) || ['contenteditable','autofocus','data-block-selected','data-cell-mode','data-axis-selection','data-cell-selection','data-delete-preview'].includes(attr.name)) element.removeAttribute(attr.name);
      if (['href','xlink:href','src'].includes(attr.name) && /^\s*javascript:/i.test(attr.value)) element.removeAttribute(attr.name);
    }
  }
  const originalInputs = source.querySelectorAll('input');
  clone.querySelectorAll('input').forEach((input, index) => {
    if (originalInputs[index]?.checked) input.setAttribute('checked', '');
    else input.removeAttribute('checked');
  });
  const images = [...Array.from(clone.querySelectorAll<HTMLImageElement>('img')), ...Array.from(clone.querySelectorAll<SVGImageElement>('svg image'))];
  // Bounded concurrency and per-export deduplication; no background downloads.
  const cache = new Map<string, Promise<string>>();
  let next = 0;
  const work = async () => {
    while (next < images.length) {
      const image = images[next++];
      const src = image.getAttribute('src') || image.getAttribute('href') || image.getAttribute('xlink:href');
      if (!src) continue;
      const absolute = new URL(src, doc.baseURI).href;
      let pending = cache.get(absolute);
      if (!pending) { pending = dataUrl(absolute); cache.set(absolute, pending); }
      const value = await pending;
      if (image.tagName.toLowerCase() === 'img') { image.setAttribute('src', value); image.removeAttribute('srcset'); image.removeAttribute('loading'); }
      else { image.setAttribute('href', value); image.removeAttribute('xlink:href'); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, images.length) }, work));
  const output = doc.implementation.createHTMLDocument(view.currentFile.basename);
  const charset = output.createElement('meta'); charset.setAttribute('charset', 'utf-8'); output.head.appendChild(charset);
  const csp = output.createElement('meta'); csp.httpEquiv = 'Content-Security-Policy';
  csp.content = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:;"; output.head.appendChild(csp);
  const style = output.createElement('style'); style.textContent = stylesheetText(doc) + '\n' + PRINT_CSS; output.head.appendChild(style);
  output.body.className = doc.body.className.replace(/theme-dark/g, 'theme-light'); output.body.classList.add('theme-light','blo-pdf');
  // Preserve the user's configured font, while selecting the light theme's colors.
  const computed = doc.defaultView!.getComputedStyle(source);
  output.body.style.setProperty('--font-text', computed.fontFamily);
  output.body.style.setProperty('--font-print', computed.fontFamily);
  output.body.style.setProperty('--font-text-size', computed.fontSize);
  const container = output.body.createDiv({ cls: 'print wysimark-container' });
  if (options.title) container.createEl('h1', { text: view.currentFile.basename, cls: 'blo-pdf-title' });
  container.appendChild(output.importNode(clone, true));
  return '<!DOCTYPE html>\n' + output.documentElement.outerHTML;
}

export class PdfExportModal extends Modal {
  private options: PdfOptions = { paper: 'A4', landscape: false, margin: 15, title: true, pages: true };
  private busy = false;
  private closed = false;
  private printOwner: Component | null = null;
  constructor(private view: BloView, private afterClose?: () => void) { super(view.app); }
  onOpen() {
    this.closed = false;
    this.titleEl.setText(ui('导出 PDF'));
    new Setting(this.contentEl).setName(ui('纸张')).addDropdown(control => control.addOptions({ A4: 'A4', A3: 'A3', Letter: 'Letter' }).setValue(this.options.paper).onChange(value => { this.options.paper = value as PdfOptions['paper']; }));
    new Setting(this.contentEl).setName(ui('横向')).addToggle(control => control.setValue(false).onChange(value => { this.options.landscape = value; }));
    new Setting(this.contentEl).setName(ui('页边距（毫米）')).addDropdown(control => control.addOptions({ '0': '0', '10': '10', '15': '15', '20': '20', '25': '25' }).setValue('15').onChange(value => { this.options.margin = Number(value); }));
    new Setting(this.contentEl).setName(ui('包含笔记标题')).addToggle(control => control.setValue(true).onChange(value => { this.options.title = value; }));
    new Setting(this.contentEl).setName(ui('显示页码')).addToggle(control => control.setValue(true).onChange(value => { this.options.pages = value; }));
    new Setting(this.contentEl).addButton(button => button.setButtonText(ui('导出 PDF')).setCta().onClick(async () => {
      if (this.busy) return;
      this.busy = true; button.setDisabled(true);
      try { if (await this.export()) this.close(); }
      catch (error) { if (!this.closed) { const message = pdfErrorMessage(error); console.error('Blo PDF export failed', message); new Notice(ui('PDF 导出失败：') + message); } }
      finally { this.busy = false; button.setDisabled(false); }
    }));
  }
  private async export(): Promise<boolean> {
    if (!Platform.isDesktopApp) throw new Error(ui('PDF 导出仅支持桌面端'));
    const electron = require('electron');
    const remote = electron.remote;
    if (!remote?.BrowserWindow || !this.view.currentFile) throw new Error(ui('无法使用系统 PDF 导出'));
    const file = this.view.currentFile;
    const result = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
      title: ui('导出 PDF'), defaultPath: file.basename + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (result.canceled || !result.filePath || this.closed) return false;
    await this.view.saveFile();
    if (this.view.currentFile !== file) throw new Error(ui('笔记已切换，请重新导出'));
    const html = await createPdfHtml(this.view, this.options);
    if (this.closed) return false;
    if (this.view.currentFile !== file) throw new Error(ui('笔记已切换，请重新导出'));
    // Isolated, invisible print surface; never run note scripts or enable Node.
    const win = new remote.BrowserWindow({ show: false, width: 1000, height: 800, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    const cleanup = () => { if (!win.isDestroyed()) win.destroy(); };
    const owner = new Component();
    owner.register(cleanup);
    this.view.addChild(owner);
    this.printOwner = owner;
    try {
      // Navigation URLs have a much lower size limit than the document itself.
      // Pass the snapshot as document content, so large images do not break loadURL.
      await win.loadURL('about:blank');
      await win.webContents.executeJavaScript(`document.open();document.write(${JSON.stringify(html)});document.close();`);
      await win.webContents.executeJavaScript(`Promise.race([(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(image=>image.decode()));return true})(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Image loading timed out')),20000))])`);
      const margin = this.options.margin / 25.4;
      const pdf = await win.webContents.printToPDF({
        pageSize: this.options.paper, landscape: this.options.landscape, printBackground: true,
        margins: { top: margin, bottom: margin, left: margin, right: margin },
        displayHeaderFooter: this.options.pages, headerTemplate: '<span></span>',
        footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#777"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
      });
      const nodeRequire = require;
      await nodeRequire('node:fs/promises').writeFile(result.filePath, pdf);
      new Notice(ui('PDF 已导出'));
      return true;
    } finally { cleanup(); this.view.removeChild(owner); this.printOwner = null; }
  }
  onClose() {
    this.closed = true; this.printOwner?.unload(); this.contentEl.empty();
    const afterClose = this.afterClose; this.afterClose = undefined; afterClose?.();
  }
}
