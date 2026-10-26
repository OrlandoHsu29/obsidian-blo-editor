import { ui } from "../wysimark/utils/translations"
import { setIcon } from 'obsidian'
import { Editor, Range } from 'slate'
import { ReactEditor } from 'slate-react'
import { findText, replaceMatches } from './model'

let nextId = 0
export class FindBar {
  private panel: HTMLDivElement
  private query: HTMLInputElement
  private replacement: HTMLInputElement
  private replaceRow: HTMLDivElement
  private count: HTMLSpanElement
  private caseButton: HTMLButtonElement
  private results: Range[] = []
  private index = 0
  private matchCase = false
  private frame = 0
  private name = `wysimark-find-${++nextId}`
  private style: HTMLStyleElement
  private resize: ResizeObserver
  constructor(private host: HTMLElement, private getEditor: () => Editor | null, private readonlyMode: () => boolean) {
    this.panel = host.createDiv({cls:'wysimark-find-panel'}); this.panel.hidden=true
    this.panel.setAttribute('role','search'); this.panel.setAttribute('aria-labelledby',this.name+'-label')
    this.panel.createSpan({text:ui("当前文档查找和替换"),attr:{id:this.name+'-label',hidden:''}})
    const row = this.panel.createDiv({cls:'wysimark-find-row'})
    this.query=row.createEl('input',{type:'text',placeholder:ui("查找文字"),attr:{'aria-label':ui("查找文字")}})
    this.count=row.createSpan({cls:'wysimark-find-count',attr:{'aria-live':'polite'}})
    this.caseButton=this.button(row,ui("区分大小写"),'case-sensitive',()=>{this.matchCase=!this.matchCase;this.caseButton.setAttribute('aria-pressed',String(this.matchCase));this.refresh(true)})
    this.caseButton.setAttribute('aria-pressed','false')
    this.button(row,ui("上一个（Shift+Enter）"),'chevron-up',()=>this.navigate(-1))
    this.button(row,ui("下一个（Enter）"),'chevron-down',()=>this.navigate(1))
    this.button(row,ui("展开或收起替换"),'replace',()=>{this.replaceRow.hidden=!this.replaceRow.hidden||this.readonlyMode();this.updateHeight()})
    this.button(row,ui("关闭（Esc）"),'x',()=>this.close(true))
    this.replaceRow=this.panel.createDiv({cls:'wysimark-find-row'});this.replaceRow.hidden=true
    this.replacement=this.replaceRow.createEl('input',{type:'text',placeholder:ui("替换为"),attr:{'aria-label':ui("替换为")}})
    this.button(this.replaceRow,ui("替换当前"),'replace',()=>this.replace(false))
    this.button(this.replaceRow,ui("全部替换"),'replace-all',()=>this.replace(true))
    this.query.addEventListener('input',()=>this.refresh(true))
    this.panel.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.close(true)}
      else if(event.key==='Enter'&&!event.isComposing){event.preventDefault();event.stopPropagation();if(event.target===this.replacement)this.replace(false);else this.navigate(event.shiftKey?-1:1)}
    })
    // Highlight rules and the registry belong to this view's window, so a
    // popout (the quick memo panel) highlights its own text.
    const doc = host.ownerDocument
    this.style=doc.head.createEl('style');this.style.textContent=`::highlight(${this.name}){background-color:var(--text-highlight-bg);color:inherit}::highlight(${this.name}-active){background-color:var(--interactive-accent);color:var(--text-on-accent)}`
    this.resize=new ResizeObserver(()=>this.updateHeight());this.resize.observe(host)
  }
  private button(row:HTMLElement,title:string,icon:string,action:()=>void) {
    const button=row.createEl('button',{type:'button',attr:{'aria-label':title,'data-tooltip-position':'bottom'}});setIcon(button,icon);button.addEventListener('click',action);return button
  }
  open(replace=false) {
    this.attach();
    const editor=this.getEditor();if(!editor)return
    if(this.panel.hidden && editor.selection && Range.isExpanded(editor.selection)) {
      const selected=Editor.string(editor,editor.selection);if(selected&&!selected.includes('\n'))this.query.value=selected
    }
    this.panel.hidden=false;this.replaceRow.hidden=!replace||this.readonlyMode();this.updateHeight();this.refresh(true);this.query.focus();this.query.select()
  }
  attach(){const slot=this.host.querySelector('[data-wysimark-find-slot]');if(slot&&this.panel.parentElement!==slot){slot.append(this.panel);const toolbar=this.host.querySelector('[data-wysimark-toolbar]');if(toolbar)this.resize.observe(toolbar)}this.updateHeight()}
  private updateHeight(){const toolbar=this.host.querySelector('[data-wysimark-toolbar]');this.host.style.setProperty('--wysimark-toolbar-height',`${toolbar?.getBoundingClientRect().height||0}px`)}
  refresh(reset=false) {
    if(this.panel.hidden)return
    const editor=this.getEditor();this.results=editor?findText(editor,this.query.value,this.matchCase):[]
    this.index=reset?0:Math.min(this.index,Math.max(0,this.results.length-1))
    this.count.textContent=this.query.value?(this.results.length?`${this.index+1} / ${this.results.length}`:ui("无结果")):''
    this.replaceRow.hidden=this.replaceRow.hidden||this.readonlyMode()
    for(const button of this.replaceRow.querySelectorAll('button'))button.disabled=this.readonlyMode()||!this.results.length
    cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.highlight(reset))
  }
  navigate(direction:number) {
    if(!this.results.length)return
    this.index=(this.index+direction+this.results.length)%this.results.length
    this.count.textContent=`${this.index+1} / ${this.results.length}`;this.highlight(true)
  }
  private highlight(scroll=false) {
    const editor=this.getEditor();if(!editor||this.panel.hidden)return
    const view=this.host.ownerDocument.defaultView as any
    const highlights=view?.CSS?.highlights,Highlight=view?.Highlight
    const domRanges=this.results.slice(0,1000).flatMap(range=>{try{return [ReactEditor.toDOMRange(editor,range)]}catch{return []}})
    let active:globalThis.Range|undefined
    try {if(this.results[this.index])active=ReactEditor.toDOMRange(editor,this.results[this.index])}catch {/* Render may still be updating. */}
    if(highlights&&Highlight){highlights.set(this.name,new Highlight(...domRanges));highlights.set(this.name+'-active',new Highlight(...(active?[active]:[])))}
    if(scroll&&active) {
      const scroller=this.host.querySelector<HTMLElement>('.wysimark-editor-container')||this.host;
      const rect=active.getBoundingClientRect(),bounds=scroller.getBoundingClientRect(),toolbar=this.host.querySelector('[data-wysimark-toolbar]')?.getBoundingClientRect();
      const top=Math.max(bounds.top+12,this.panel.getBoundingClientRect().bottom,toolbar?.bottom||0)+12
      if(rect.top<top)scroller.scrollTop-=top-rect.top
      else if(rect.bottom>bounds.bottom-20)scroller.scrollTop+=rect.bottom-bounds.bottom+20
    }
  }
  replace(all:boolean) {
    const editor=this.getEditor();if(!editor||this.readonlyMode())return
    this.results=findText(editor,this.query.value,this.matchCase)
    const current=this.results[Math.min(this.index,this.results.length-1)]
    replaceMatches(editor,all?this.results:(current?[current]:[]),this.replacement.value);this.refresh(false)
  }
  close(focus=false){this.panel.hidden=true;this.host.style.removeProperty('--wysimark-find-height');cancelAnimationFrame(this.frame);const highlights=(this.host.ownerDocument.defaultView?.CSS as any)?.highlights;highlights?.delete(this.name);highlights?.delete(this.name+'-active');const editor=this.getEditor();if(focus&&editor&&!this.readonlyMode())ReactEditor.focus(editor)}
  destroy(){this.resize.disconnect();this.close();this.panel.remove();this.style.remove();this.host.style.removeProperty('--wysimark-toolbar-height')}
}
