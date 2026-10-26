import { MenuItemData } from '../../shared-overlays'
import { t, ui } from '../../utils/translations'
import { Drawing, Formula, Normal, TextColorPreview } from '../icons'
import { canInsertMath } from '../../math-plugin'
import { isFixedToolbarButton } from '../../../toolbar-preferences'
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
type ToolbarIcon = Exclude<MenuItemData, 'divider'>['icon']
type ToolbarEntry = { id: string; settingsIcon: ToolbarIcon; item: Exclude<MenuItemData, 'divider'> }
function entry(id: string, item: MenuItemData, settingsIcon?: ToolbarIcon): ToolbarEntry {
  if (item === 'divider') throw new Error('Toolbar entry must be a button');
  return { id, settingsIcon: settingsIcon ?? item.icon, item };
}
/** Stable IDs keep preferences independent of language and button order. */
export const toolbarGroups: ToolbarEntry[][] = [
  [entry('paragraph-style',pick(compactBlockItems,t('paragraphStyle')),Normal),
    entry('clear-formatting',clearStyleItem)],
  [entry('undo',historyItems[0]),entry('redo',historyItems[1])],
  [entry('text-color',expandedMarkItems[0],TextColorPreview),entry('bold',pick(expandedMarkItems,t('bold'))),
    entry('italic',pick(expandedMarkItems,t('italic'))),entry('underline',pick(expandedMarkItems,t('underline'))),
    entry('strike',pick(expandedMarkItems,t('strike'))),entry('check-list',pick(listItems,t('checkList'))),
    entry('numbered-list',pick(listItems,t('numberedList'))),entry('bullet-list',pick(listItems,t('bulletList'))),
    entry('quote',pick(expandedQuoteItems,t('quote'))),entry('code-block',pick(expandedQuoteItems,t('codeBlock'))),
    entry('horizontal-rule',pick(dialogItems,t('horizontalRule')))],
  [entry('outdent',blockIndentItems[0]),entry('indent',blockIndentItems[1])],
  [entry('table',pick(dialogItems,t('insertTable'))),
    entry('inline-math', { title: ui('插入行内公式'), icon: Formula, hotkey: 'mod+shift+m', focusEditor: false, disabled: editor => !canInsertMath(editor), action: editor => { editor.math.insertInline() } }),
    entry('link',pick(dialogItems,t('insertLink'))),
    entry('image',pick(dialogItems,t('insertImageFromUrl'))),
    entry('drawing',{ title: ui('插入画板'), icon: Drawing, show: editor => editor.wysimark.integrationPreferences?.getSnapshot().drawings ?? true, action: editor => { void editor.wysimark.insertDrawing?.() } })],
  [entry('find-replace',utilityItems[0])],
];
export function visibleToolbarItems(hidden: readonly string[], show: (item: ToolbarEntry['item']) => boolean = () => true): MenuItemData[] {
  const excluded = new Set(hidden);
  const result: MenuItemData[] = [];
  for (const group of toolbarGroups) {
    const visible = group.filter(entry => (isFixedToolbarButton(entry.id) || !excluded.has(entry.id)) && show(entry.item));
    if (!visible.length) continue;
    if (result.length) result.push('divider');
    result.push(...visible.map(entry => entry.item));
  }
  return result;
}
export const items = visibleToolbarItems([]);
// Preserve upstream exports without maintaining different button orders.
export const largeItems=items,mediumItems=items,smallItems=items,initialItems=items
export const itemSets=[items]
