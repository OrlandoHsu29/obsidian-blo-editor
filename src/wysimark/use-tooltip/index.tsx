/** Obsidian renders the single native tooltip from the element aria-label. */
export function tooltipLabel({title,hotkey}:{title:string;hotkey?:string|(()=>string|undefined)}) {
  const shortcut=typeof hotkey==='function'?hotkey():hotkey
  return shortcut?`${title} (${shortcut})`:title
}
