import { htmlToMarkdown } from 'obsidian'

/** Preserve semantic marks even where Markdown punctuation cannot open/close them. */
export function clipboardHtmlToMarkdown(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  // Yuque and other editors may style their first row as a header using only
  // <td>. The Markdown converter otherwise prepends a synthetic empty header.
  // Promote the existing row rather than deleting any genuinely empty rows.
  for (const table of document.body.querySelectorAll('table')) {
    if (table.closest('pre,code')) continue
    const firstRow = table.rows[0]
    if (!firstRow || firstRow.parentElement?.localName === 'thead') continue
    for (const cell of Array.from(firstRow.cells)) {
      if (cell.localName === 'th') continue
      const header = document.createElement('th')
      for (const attribute of Array.from(cell.attributes)) header.setAttribute(attribute.name, attribute.value)
      header.append(...cell.childNodes)
      cell.replaceWith(header)
    }
  }
  let prefix = '\uE000blo'
  while (html.includes(prefix)) prefix += 'x'
  const tags: string[] = []
  const token = (tag: string) => `${prefix}${tags.push(tag) - 1}\uE001`
  for (const element of document.body.querySelectorAll('strong,b,em,i,s,del,u,mark,sup,sub,kbd')) {
    if (element.closest('pre,code')) continue
    element.before(document.createTextNode(token(`<${element.localName}>`)))
    element.after(document.createTextNode(token(`</${element.localName}>`)))
    element.replaceWith(...element.childNodes)
  }
  const markdown = htmlToMarkdown(document.body)
  return markdown.replace(new RegExp(`${prefix}(\\d+)\uE001`, 'g'), (_, index: string) => tags[Number(index)])
}
