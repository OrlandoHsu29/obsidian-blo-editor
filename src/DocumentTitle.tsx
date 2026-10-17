import { ui } from "./wysimark/utils/translations"
import { App, Notice, TFile } from 'obsidian'
import * as React from 'react'

/** File name belongs to the view, never to Markdown or Slate's text selection. */
export function DocumentTitle({app,file,save}:{app:App;file:TFile;save:()=>Promise<void>}) {
  const labelId=React.useId()
  const [name,setName]=React.useState(file.basename)
  const [saving,setSaving]=React.useState(false)
  React.useEffect(()=>{
    setName(file.basename)
    const ref=app.vault.on('rename',renamed=>{if(renamed===file)setName(file.basename)})
    return ()=>app.vault.offref(ref)
  },[app,file])
  const commit=async()=>{
    const next=name.trim()
    if(next===file.basename)return
    if(!next||/[\\/:*?"<>|]/.test(next)||/[. ]$/.test(next)||['.','..'].includes(next)) {
      new Notice(ui("文件名不能为空，也不能包含路径或特殊字符"));setName(file.basename);return
    }
    const path=(file.parent?.path?file.parent.path+'/':'')+next+'.'+file.extension
    const existing=app.vault.getAbstractFileByPath(path)
    if(existing&&existing!==file){new Notice(ui("已有同名文件，请使用其他名称"));setName(file.basename);return}
    setSaving(true)
    try {await save();await app.fileManager.renameFile(file,path);setName(file.basename);app.workspace.requestSaveLayout()}
    catch(error){new Notice(ui("重命名失败：")+String(error));setName(file.basename)}
    finally{setSaving(false)}
  }
  return <div className="wysimark-document-title" contentEditable={false}>
    <span id={labelId} className="wysimark-accessible-label">{ui("文件名；修改后按 Enter 或点击正文重命名")}</span>
    <input aria-labelledby={labelId} value={name} disabled={saving} spellCheck={false}
      onChange={event=>setName(event.target.value)} onBlur={()=>void commit()}
      onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.blur()}else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();event.currentTarget.value=file.basename;setName(file.basename)}}} />
  </div>
}
