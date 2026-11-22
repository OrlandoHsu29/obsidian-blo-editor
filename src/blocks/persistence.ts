import type { Element } from '../wysimark/convert/types'
import { Element as SlateElement, Node } from 'slate'
import { blockDepth, isEditorSpacer, isFoldableList, isListBlock, orderedNumbers } from './model'
import { headingDefaults, parseHeadingDefaults } from './heading-defaults'

const prefix='<!-- wysimark-block:v1 '
const formats = new WeakMap<Element, {
  subtitles: number[][]
  headingStyles: ({ path: number[] } & NonNullable<Element['__headingList']>)[]
  quoteIndents: { path: number[]; depth: number }[]
}>()
function blockFormats(node:Element) {
  let value=formats.get(node)
  if(!value) {
    value={subtitles:[],headingStyles:[],quoteIndents:[]}
    for(const [element,path] of Node.elements(node)) {
      if(element.__subtitle)value.subtitles.push(path)
      if(element.type==='heading'&&element.__headingList)value.headingStyles.push({path,...element.__headingList})
      if(path.length && element.__quoteIndent)value.quoteIndents.push({path,depth:element.__quoteIndent})
    }
    formats.set(node,value)
  }
  return value
}
export function needsBlockMetadata(nodes: Element[]) {return nodes.some(n=>headingDefaults(n)||n.__collapsed||n.__blockDepth!==undefined||n.__numbering!==undefined||blockFormats(n).subtitles.length>0||blockFormats(n).headingStyles.length>0||blockFormats(n).quoteIndents.length>0)}
export function serializeBlockDocument(nodes: Element[], serializeOne:(node:Element,number?:number)=>string) {
  const numbers=orderedNumbers(nodes)
  return nodes.filter(n=>!isEditorSpacer(n)).map(node=>{
    const {subtitles,headingStyles:styles,quoteIndents}=blockFormats(node)
    const metadata={depth:blockDepth(node),headingDefaults:headingDefaults(node),collapsed:node.__collapsed||undefined,subtitles:subtitles.length?subtitles:undefined,headingStyles:styles.length?styles:undefined,quoteIndents:quoteIndents.length?quoteIndents:undefined,numbering:node.__numbering,start:node.type==='ordered-list-item'?node.start:undefined}
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
    const defaults = parseHeadingDefaults(chunk.metadata.headingDefaults)
    if (defaults) node.__headingDefaults = defaults
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
      if(SlateElement.isElement(target)&&target.type==='heading')target.__headingList={style:saved.style,enabled:saved.enabled,
        ...(Array.isArray(saved.levels)&&saved.levels.every((level:unknown)=>typeof level==='number'&&Number.isInteger(level)&&level>=1&&level<=4)
          ?{levels:[...new Set(saved.levels)] as (1|2|3|4)[]}:{})}
    }
    if (Array.isArray(chunk.metadata.quoteIndents)) for (const saved of chunk.metadata.quoteIndents) {
      if (!saved || !Array.isArray(saved.path) || !saved.path.length ||
        !saved.path.every((index: unknown) => Number.isInteger(index) && Number(index) >= 0) ||
        !Number.isInteger(saved.depth) || saved.depth < 1 || saved.depth > 32 || !Node.has(node, saved.path)) continue
      const parent = Node.parent(node, saved.path)
      const target = Node.get(node, saved.path)
      if (SlateElement.isElement(parent) && parent.type === 'block-quote' &&
        SlateElement.isElement(target) && target.type !== 'block-quote') target.__quoteIndent = saved.depth
    }
    if(node.type==='ordered-list-item'&&!recoveredList) {
      if(typeof chunk.metadata.start==='number')node.start=chunk.metadata.start;else delete node.start
      if(['continue','restart','explicit'].includes(chunk.metadata.numbering))node.__numbering=chunk.metadata.numbering
    }
    result.push(node,...parsed.slice(1))
  }
  return result
}
