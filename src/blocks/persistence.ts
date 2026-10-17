import type { Element } from '../wysimark/convert/types'
import { Element as SlateElement, Node } from 'slate'
import { blockDepth, isEditorSpacer, isListBlock, orderedNumbers } from './model'

const prefix='<!-- wysimark-block:v1 '
const subtitlePaths=(node:Element)=>[...Node.elements(node)].filter(([n])=>n.__subtitle).map(([,path])=>path)
export function needsBlockMetadata(nodes: Element[]) {return nodes.some(n=>n.__blockDepth!==undefined||n.__numbering!==undefined||subtitlePaths(n).length>0)}
export function serializeBlockDocument(nodes: Element[], serializeOne:(node:Element)=>string) {
  const numbers=orderedNumbers(nodes)
  return nodes.filter(n=>!isEditorSpacer(n)).map(node=>{
    const subtitles=subtitlePaths(node)
    const metadata={depth:blockDepth(node),subtitles:subtitles.length?subtitles:undefined,numbering:node.__numbering,start:node.type==='ordered-list-item'?node.start:undefined}
    const plain=isListBlock(node)?{...node,depth:0,...(node.type==='ordered-list-item'?{start:numbers.get(node)}:{})}:node
    return `${prefix}${encodeURIComponent(JSON.stringify(metadata))} -->\n\n${serializeOne(plain as Element).trimEnd()}\n\n`
  }).join('').trimEnd()+'\n'
}
export function parseBlockDocument(source: string, parseOne:(text:string)=>Element[]): Element[]|null {
  if(!source.trimStart().startsWith(prefix))return null
  const chunks:{metadata:any;lines:string[]}[]=[],lines=source.replace(/\r\n/g,'\n').split('\n');let fence=''
  for(const line of lines) {
    const code=line.match(/^\s*(`{3,}|~{3,})/)
    if(code){if(!fence)fence=code[1];else if(code[1][0]===fence[0]&&code[1].length>=fence.length)fence=''}
    if(!fence&&line.startsWith(prefix)&&line.endsWith(' -->')) {
      try{chunks.push({metadata:JSON.parse(decodeURIComponent(line.slice(prefix.length,-4))),lines:[]})}catch{return null}
    }else if(chunks.length)chunks[chunks.length-1].lines.push(line)
  }
  const result:Element[]=[]
  for(const chunk of chunks) {
    const parsed=parseOne(chunk.lines.join('\n').trim());const node=parsed[0]
    if(!node)return null
    const depth=Math.max(0,Math.min(32,Number(chunk.metadata.depth)||0))
    if(isListBlock(node))(node as Element & {depth:number}).depth=depth
    node.__blockDepth=depth
    const paths=Array.isArray(chunk.metadata.subtitles)?chunk.metadata.subtitles:chunk.metadata.subtitle===true?[[]]:[]
    for(const path of paths)if(Array.isArray(path)&&path.every(i=>Number.isInteger(i)&&i>=0)&&Node.has(node,path)) {
      const target=Node.get(node,path)
      if(SlateElement.isElement(target)&&target.type==='paragraph') {
        Object.assign(target,{type:'heading',level:5});delete target.__subtitle
      } else if(SlateElement.isElement(target)&&isListBlock(target)&&!('blockChildren' in target&&target.blockChildren)) {
        target.children=[{type:'heading',level:5,children:target.children}];(target as unknown as {blockChildren:boolean}).blockChildren=true
      }
    }
    if(node.type==='ordered-list-item') {
      if(typeof chunk.metadata.start==='number')node.start=chunk.metadata.start;else delete node.start
      if(['continue','restart'].includes(chunk.metadata.numbering))node.__numbering=chunk.metadata.numbering
    }
    result.push(node,...parsed.slice(1))
  }
  return result
}
