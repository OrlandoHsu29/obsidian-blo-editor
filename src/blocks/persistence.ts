import type { Element } from '../wysimark/convert/types'
import { Element as SlateElement, Node } from 'slate'
import { blockDepth, isEditorSpacer, isFoldableList, isListBlock, orderedNumbers } from './model'

const prefix='<!-- wysimark-block:v1 '
const formats = new WeakMap<Element, { subtitles:number[][]; headingStyles:({path:number[]} & NonNullable<Element['__headingList']>)[] }>()
function blockFormats(node:Element) {
  let value=formats.get(node)
  if(!value) {
    value={subtitles:[],headingStyles:[]}
    for(const [element,path] of Node.elements(node)) {
      if(element.__subtitle)value.subtitles.push(path)
      if(element.type==='heading'&&element.__headingList)value.headingStyles.push({path,...element.__headingList})
    }
    formats.set(node,value)
  }
  return value
}
export function needsBlockMetadata(nodes: Element[]) {return nodes.some(n=>n.__collapsed||n.__blockDepth!==undefined||n.__numbering!==undefined||blockFormats(n).subtitles.length>0||blockFormats(n).headingStyles.length>0)}
export function serializeBlockDocument(nodes: Element[], serializeOne:(node:Element,number?:number)=>string) {
  const numbers=orderedNumbers(nodes)
  return nodes.filter(n=>!isEditorSpacer(n)).map(node=>{
    const {subtitles,headingStyles:styles}=blockFormats(node)
    const metadata={depth:blockDepth(node),collapsed:node.__collapsed||undefined,subtitles:subtitles.length?subtitles:undefined,headingStyles:styles.length?styles:undefined,numbering:node.__numbering,start:node.type==='ordered-list-item'?node.start:undefined}
    const plain=isListBlock(node)?{...node,depth:0,...(node.type==='ordered-list-item'?{start:numbers.get(node)}:{})}:node
    return `${prefix}${encodeURIComponent(JSON.stringify(metadata))} -->\n\n${serializeOne(plain as Element,numbers.get(node)).trimEnd()}\n\n`
  }).join('').trimEnd()+'\n'
}
export function parseBlockDocument(source: string, parseOne:(text:string)=>Element[]): Element[]|null {
  if(!source.includes(prefix))return null
  // A pasted block, a newly added paragraph, or a missing first marker must not
  // turn all subsequent metadata into visible HTML or discard the plain prefix.
  const chunks:{metadata?:any;lines:string[]}[]=[{lines:[]}],lines=source.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').split('\n');let fence='',found=false
  for(const line of lines) {
    const code=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if(code){if(!fence){if(code[1][0]!=='`'||!code[2].includes('`'))fence=code[1]}else if(code[1][0]===fence[0]&&code[1].length>=fence.length&&!code[2].trim())fence=''}
    if(!fence&&line.startsWith(prefix)&&line.endsWith(' -->')) {
      try{
        const metadata=JSON.parse(decodeURIComponent(line.slice(prefix.length,-4)))
        if(metadata&&typeof metadata==='object'&&!Array.isArray(metadata)){
          chunks.push({metadata,lines:[]});found=true;continue
        }
      }catch{/* Keep invalid source literal without breaking other blocks. */}
    }
    chunks[chunks.length-1].lines.push(line)
  }
  if(!found)return null
  const result:Element[]=[]
  for(const chunk of chunks) {
    if(!chunk.metadata){
      const plain=chunk.lines.join('\n').trim()
      if(plain)result.push(...parseOne(plain))
      continue
    }
    const parsed=parseOne(chunk.lines.join('\n').trim());const node=parsed[0]
    if(!node)continue
    if(chunk.metadata.collapsed===true&&isFoldableList(node))node.__collapsed=true
    const depth=Math.max(0,Math.min(32,Number(chunk.metadata.depth)||0))
    const recoveredList=isListBlock(node)&&node.__blockDepth!==undefined
    // A chunk can recover several list items. Keep their relative indentation
    // and add the enclosing block's saved depth to every recovered item.
    for(const item of parsed) {
      const itemDepth=Math.min(32,depth+blockDepth(item))
      if(isListBlock(item))(item as Element & {depth:number}).depth=itemDepth
      item.__blockDepth=itemDepth
    }
    const paths=Array.isArray(chunk.metadata.subtitles)?chunk.metadata.subtitles:chunk.metadata.subtitle===true?[[]]:[]
    for(const path of paths)if(Array.isArray(path)&&path.every(i=>Number.isInteger(i)&&i>=0)&&Node.has(node,path)) {
      const target=Node.get(node,path)
      if(SlateElement.isElement(target)&&target.type==='paragraph') {
        Object.assign(target,{type:'heading',level:5});delete target.__subtitle
      } else if(SlateElement.isElement(target)&&isListBlock(target)&&!('blockChildren' in target&&target.blockChildren)) {
        target.children=[{type:'heading',level:5,children:target.children}];(target as unknown as {blockChildren:boolean}).blockChildren=true
      }
    }
    if(Array.isArray(chunk.metadata.headingStyles))for(const saved of chunk.metadata.headingStyles) {
      if(!saved||!Array.isArray(saved.path)||!saved.path.every((i:unknown)=>typeof i==='number'&&Number.isInteger(i)&&i>=0)||!Node.has(node,saved.path)||!['hash','number'].includes(saved.style)||typeof saved.enabled!=='boolean')continue
      const target=Node.get(node,saved.path)
      if(SlateElement.isElement(target)&&target.type==='heading')target.__headingList={style:saved.style,enabled:saved.enabled}
    }
    if(node.type==='ordered-list-item'&&!recoveredList) {
      if(typeof chunk.metadata.start==='number')node.start=chunk.metadata.start;else delete node.start
      if(['continue','restart','explicit'].includes(chunk.metadata.numbering))node.__numbering=chunk.metadata.numbering
    }
    result.push(node,...parsed.slice(1))
  }
  return result
}
