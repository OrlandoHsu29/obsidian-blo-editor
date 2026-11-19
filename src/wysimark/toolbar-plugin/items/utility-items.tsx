import { ui } from "../../utils/translations"
import { MenuItemData } from '../../shared-overlays'
import { clearFormatting } from '../../marks-plugin/methods/clear-formatting'
import * as Icon from '../icons'
import { HistoryEditor } from 'slate-history'
import { Editor } from 'slate'
import { blockDepth, canIndentBlock, currentRootBlock, indentCurrentBlock, indentSelectedBlocks, selectedRootBlocks } from '../../../blocks/model'
import { t } from '../../utils/translations'
function selectedDepths(editor:Editor) {
  const nodes=selectedRootBlocks(editor).map(({node})=>node)
  return nodes.some(node=>!canIndentBlock(node))?[]:nodes.map(blockDepth)
}
function indentMenu(delta:1|-1):MenuItemData {
  const icon=delta===1?Icon.IncreaseDepth:Icon.DecreaseDepth
  const hotkey=delta===1?'tab':'shift+tab'
  const children:Exclude<MenuItemData,'divider'>[]=[
    {title:ui(delta===1?'缩进（包含子项）':'回退（包含子项）'),icon,hotkey,
      disabled:editor=>{const depths=selectedDepths(editor);return editor.wysimark.readOnly||!depths.length||(delta===1?depths.some(depth=>depth>=32):!depths.some(depth=>depth>0))},
      action:editor=>{indentSelectedBlocks(editor,delta)}},
    {title:ui(delta===1?'仅缩进当前块':'仅回退当前块'),icon:delta===1?Icon.IncreaseBlockDepth:Icon.DecreaseBlockDepth,hotkey:delta===1?'mod+]':'mod+[',
      disabled:editor=>{const current=currentRootBlock(editor);return editor.wysimark.readOnly||!current||!canIndentBlock(current.node)||(delta===1?blockDepth(current.node)>=32:blockDepth(current.node)===0)},
      action:editor=>{indentCurrentBlock(editor,delta)}},
  ]
  return {title:t(delta===1?'increaseDepth':'decreaseDepth'),icon,hotkey,more:true,children,
    disabled:editor=>children.every(item=>item.disabled?.(editor))}
}
export const blockIndentItems:MenuItemData[]=[indentMenu(-1),indentMenu(1)]
export const clearStyleItem:MenuItemData={title:ui("清除格式"),icon:Icon.ClearFormatting,action:editor=>clearFormatting(editor)}
export const historyItems:MenuItemData[]=[
  {title:ui('撤销'),icon:Icon.Undo,hotkey:'mod+z',disabled:editor=>!HistoryEditor.isHistoryEditor(editor)||!editor.history.undos.length,action:editor=>{if(HistoryEditor.isHistoryEditor(editor)&&editor.history.undos.length)editor.undo()}},
  {title:ui('重做'),icon:Icon.Redo,hotkey:'mod+shift+z',disabled:editor=>!HistoryEditor.isHistoryEditor(editor)||!editor.history.redos.length,action:editor=>{if(HistoryEditor.isHistoryEditor(editor)&&editor.history.redos.length)editor.redo()}},
]
export const utilityItems:MenuItemData[]=[
  {title:ui("查找／替换"),icon:Icon.FindReplace,hotkey:'mod+f',focusEditor:false,action:editor=>editor.wysimark.openSearch?.(false)},
]
