import { htmlToMarkdown } from 'obsidian'

/** Preserve semantic marks even where Markdown punctuation cannot open/close them. */
export function clipboardHtmlToMarkdown(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
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
