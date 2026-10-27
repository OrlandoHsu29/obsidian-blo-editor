import { Plugin, setIcon } from 'obsidian'
import { ui } from './wysimark/utils/translations'
import type { Editor } from 'slate'
import { imageDescriptionTarget } from './image-description'
export function installImageViewerIntegration(plugin:Plugin, getEditors: () => Editor[]) {
    let cancelEdit: (() => void) | undefined
    plugin.register(() => cancelEdit?.())
    plugin.registerDomEvent(document, 'dblclick', event => {
      const title = (event.target as Element)?.closest<HTMLElement>('.oit-normal .oit-img-title')
      if (!title || title.querySelector('input')) return
      const toolkit = (plugin.app as any).plugins.plugins['obsidian-image-toolkit']
      const container = toolkit?.getAllContainerViews?.().find(view => view.imgInfo?.oitContainerEl === title.closest('.oit'))
      const active = container?.getActiveImg?.()
      const source = active?.targetOriginalImgEl as HTMLImageElement | undefined
      // Gallery navigation may display a different image from the one originally opened.
      if (!source?.isConnected || source.src !== active?.imgViewEl?.src || source.alt !== active.imgViewEl.alt) return
      let target: ReturnType<typeof imageDescriptionTarget>
      for (const editor of getEditors()) {
        target = imageDescriptionTarget(editor, source)
        if (target) break
      }
      if (!target) return
      event.preventDefault(); event.stopPropagation()
      cancelEdit?.()
      const label = title.querySelector<HTMLElement>('.oit-img-title-name') || title
      const previous = label.textContent || ''
      const input = title.ownerDocument.createElement('input')
      input.className = 'blo-image-description-input'
      input.setAttribute('aria-label', ui('内容描述（可选）'))
      input.value = target.value
      let finished = false
      const observer = new MutationObserver(() => {
        if (!input.isConnected || container.imgInfo.oitContainerEl.style.display === 'none' || source.src !== active.imgViewEl.src || source.alt !== active.imgViewEl.alt) finish(false)
      })
      const finish = (save: boolean) => {
        if (finished) return
        finished = true
        observer.disconnect()
        const value = input.value.trim()
        const attached = label.contains(input)
        const saved = save && attached && source.isConnected && source.src === active.imgViewEl.src && target.save(value)
        target.dispose()
        input.remove()
        if (attached) label.textContent = saved ? value : previous
        if (saved) active.imgViewEl.alt = value
        cancelEdit = undefined
      }
      cancelEdit = () => finish(false)
      label.replaceChildren(input)
      observer.observe(title, { childList: true, subtree: true })
      observer.observe(active.imgViewEl, { attributes: true, attributeFilter: ['src', 'alt'] })
      observer.observe(container.imgInfo.oitContainerEl, { attributes: true, attributeFilter: ['style'] })
      for (const name of ['click', 'dblclick', 'mousedown', 'keyup'] as const) input.addEventListener(name, event => event.stopPropagation())
      input.addEventListener('keydown', event => {
        event.stopPropagation()
        if (event.isComposing) return
        if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); finish(event.key === 'Enter') }
      })
      input.addEventListener('blur', () => finish(true), { once: true })
      input.focus(); input.select()
    }, true)
    const imageIcons:Record<string,[string,string]>={toolbar_zoom_to_100:['scan',ui("原始尺寸")],toolbar_zoom_in:['zoom-in',ui("放大")],toolbar_zoom_out:['zoom-out',ui("缩小")],toolbar_full_screen:['expand',ui("全屏")],toolbar_refresh:['refresh-cw',ui("刷新")],toolbar_rotate_left:['rotate-ccw',ui("向左旋转")],toolbar_rotate_right:['rotate-cw',ui("向右旋转")],toolbar_scale_x:['flip-horizontal',ui("水平翻转")],toolbar_scale_y:['flip-vertical',ui("垂直翻转")],toolbar_invert_color:['contrast',ui("反色")],toolbar_copy:['copy',ui("复制")]};
    const styleImageIcons=()=>{
      for(const item of document.querySelectorAll<HTMLElement>('.oit-img-toolbar > li')) {
        const key=Object.keys(imageIcons).find(key=>item.classList.contains(key));if(!key)continue;
        if(item.dataset.wysimarkIcon!==key){setIcon(item,imageIcons[key][0]);item.dataset.wysimarkIcon=key}
        item.setAttribute('aria-label',imageIcons[key][1]);item.removeAttribute('title');
      }
    };
    const imageObserver=new MutationObserver(records=>{if(records.some(record=>(record.target instanceof Element&&record.target.closest('.oit-img-toolbar'))||[...record.addedNodes].some(node=>node instanceof Element&&(node.matches('.oit-img-toolbar')||node.querySelector('.oit-img-toolbar')))))styleImageIcons()});imageObserver.observe(document.body,{childList:true,subtree:true});styleImageIcons();plugin.register(()=>imageObserver.disconnect());

}
