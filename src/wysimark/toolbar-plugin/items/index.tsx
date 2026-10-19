import { MenuItemData } from '../../shared-overlays'
import { t, ui } from '../../utils/translations'
import { Drawing } from '../icons'
import { compactBlockItems } from './block-items'
import { dialogItems } from './dialogItems'
import { expandedMarkItems } from './mark-items'
import { listItems } from './list-items'
import { expandedQuoteItems } from './quote-items'
import { blockIndentItems, clearStyleItem, historyItems, utilityItems } from './utility-items'

function pick(items:MenuItemData[],title:string):Exclude<MenuItemData,'divider'> {
  const item=items.find(item=>item!=='divider'&&item.title===title)
  if(!item||item==='divider')throw new Error('Missing toolbar item: '+title)
  return item
}
/** Keep the same five groups in every viewport; narrow views scroll horizontally. */
export const items:MenuItemData[]=[
  pick(compactBlockItems,t('paragraphStyle')),clearStyleItem,...historyItems,
  'divider',
  expandedMarkItems[0],pick(expandedMarkItems,t('bold')),pick(expandedMarkItems,t('italic')),
  pick(expandedMarkItems,t('underline')),pick(expandedMarkItems,t('strike')),
  pick(listItems,t('numberedList')),pick(listItems,t('bulletList')),pick(expandedQuoteItems,t('quote')),
  pick(expandedQuoteItems,t('codeBlock')),pick(dialogItems,t('horizontalRule')),
  'divider',
  ...blockIndentItems,
  'divider',
  pick(dialogItems,t('insertTable')),
  pick(dialogItems,t('insertLink')),pick(dialogItems,t('insertImageFromUrl')),
  { title: ui('插入画板'), icon: Drawing, action: editor => { void editor.wysimark.insertDrawing?.() } },
  'divider',
  ...utilityItems,
]
// Preserve upstream exports without maintaining different button orders.
export const largeItems=items,mediumItems=items,smallItems=items,initialItems=items
export const itemSets=[items]
