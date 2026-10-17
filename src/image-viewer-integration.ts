import { Plugin, setIcon } from 'obsidian'
import { ui } from './wysimark/utils/translations'
export function installImageViewerIntegration(plugin:Plugin) {
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
