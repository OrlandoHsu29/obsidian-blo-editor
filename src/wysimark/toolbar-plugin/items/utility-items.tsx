import { ui } from "../../utils/translations"
import { MenuItemData } from '../../shared-overlays'
import { clearFormatting } from '../../marks-plugin/methods/clear-formatting'
import * as Icon from '../icons'
import { HistoryEditor } from 'slate-history'
import { Editor, Range } from 'slate'
import { blockDepth, indentSelectedBlocks, isEditorSpacer } from '../../../blocks/model'
import { t } from '../../utils/translations'
function selectedDepths(editor:Editor) {
  if(editor.wysimark.readOnly||!editor.selection)return []
  const [start,end]=Range.edges(editor.selection)
  return editor.children.slice(start.path[0],end.path[0]+1).filter(n=>!isEditorSpacer(n)).map(blockDepth)
}
export const blockIndentItems:MenuItemData[]=[
  {title:t('decreaseDepth'),icon:Icon.DecreaseDepth,hotkey:'shift+tab',disabled:editor=>!selectedDepths(editor).some(depth=>depth>0),action:editor=>{indentSelectedBlocks(editor,-1)}},
  {title:t('increaseDepth'),icon:Icon.IncreaseDepth,hotkey:'tab',disabled:editor=>{const depths=selectedDepths(editor);return !depths.length||depths.some(depth=>depth>=32)},action:editor=>{indentSelectedBlocks(editor,1)}},
]
export const clearStyleItem:MenuItemData={title:ui("清除格式"),icon:Icon.ClearFormatting,action:editor=>clearFormatting(editor)}
export const historyItems:MenuItemData[]=[
  {title:ui('撤销'),icon:Icon.Undo,hotkey:'mod+z',disabled:editor=>!HistoryEditor.isHistoryEditor(editor)||!editor.history.undos.length,action:editor=>{if(HistoryEditor.isHistoryEditor(editor)&&editor.history.undos.length)editor.undo()}},
  {title:ui('重做'),icon:Icon.Redo,hotkey:'mod+shift+z',disabled:editor=>!HistoryEditor.isHistoryEditor(editor)||!editor.history.redos.length,action:editor=>{if(HistoryEditor.isHistoryEditor(editor)&&editor.history.redos.length)editor.redo()}},
]
export const utilityItems:MenuItemData[]=[
  {title:ui("查找／替换"),icon:Icon.FindReplace,focusEditor:false,action:editor=>editor.wysimark.openSearch?.(true)},
]
