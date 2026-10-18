/** The toolbar and imported text share one finite color palette. */
export const TEXT_COLORS = {
  red: '#DF2A3F', orange: '#ED740C', yellow: '#AD8500', green: '#00A650',
  blue: '#1677FF', purple: '#7C3AED', gray: '#787878',
} as const
type RGB = [number, number, number]
const names: Record<string, string> = {
  black:'#000000',white:'#ffffff',gray:'#808080',grey:'#808080',silver:'#c0c0c0',
  lightgray:'#d3d3d3',lightgrey:'#d3d3d3',darkgray:'#a9a9a9',darkgrey:'#a9a9a9',
  gainsboro:'#dcdcdc',whitesmoke:'#f5f5f5',snow:'#fffafa',ivory:'#fffff0',
  red:'#ff0000',orange:'#ffa500',yellow:'#ffff00',green:'#008000',lime:'#00ff00',
  blue:'#0000ff',navy:'#000080',purple:'#800080',violet:'#ee82ee',rebeccapurple:'#663399',
  magenta:'#ff00ff',fuchsia:'#ff00ff',teal:'#008080',cyan:'#00ffff',aqua:'#00ffff',
  maroon:'#800000',olive:'#808000',pink:'#ffc0cb',brown:'#a52a2a',
}
function rgb(value:string):RGB|undefined {
  const named=names[value]
  if(named)return rgb(named)
  const hex=/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value)?.[1]
  if(hex){const full=hex.length<5?hex.split('').map(c=>c+c).join(''):hex;return [0,2,4].map(i=>parseInt(full.slice(i,i+2),16)) as RGB}
  const functional=/^(rgba?|hsla?)\((.*)\)$/.exec(value)
  if(functional){
    const parts=functional[2].trim().split(/[\s,/]+/)
    if(parts.length<3||parts.length>4)return
    const number=(part:string,scale:number)=>part.endsWith('%')?Number(part.slice(0,-1))*scale/100:Number(part)
    if(functional[1].startsWith('rgb')){
      const channels=parts.slice(0,3).map(p=>number(p,255))
      return channels.every(n=>Number.isFinite(n)&&n>=0&&n<=255)?channels as RGB:undefined
    }
    const hue=((Number(parts[0])%360)+360)%360/60,s=number(parts[1],1),l=number(parts[2],1)
    if(![hue,s,l].every(Number.isFinite)||s<0||s>1||l<0||l>1)return
    const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(hue%2-1)),m=l-c/2
    const channels=hue<1?[c,x,0]:hue<2?[x,c,0]:hue<3?[0,c,x]:hue<4?[0,x,c]:hue<5?[x,0,c]:[c,0,x]
    return channels.map(n=>(n+m)*255) as RGB
  }
  // CSS names beyond the common set are resolved once, never on every render.
  if(typeof document!=='undefined'&&/^[a-z]+$/.test(value)){
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d')
    if(context){context.fillStyle='#010203';context.fillStyle=value;const resolved=context.fillStyle;if(resolved!=='#010203')return rgb(resolved)}
  }
}
const paletteRGB=new Map(Object.values(TEXT_COLORS).map(color=>[color,rgb(color.toLowerCase())!]))
const mapped=new Map<string,{foreground?:string;background?:string}>()
export function mappedTextColors(value:string):{foreground?:string;background?:string} {
  const key=value.trim().toLowerCase()
  const cached=mapped.get(key);if(cached)return cached
  const channels=rgb(key)
  let result:{foreground?:string;background?:string}={}
  if(channels){
    const high=Math.max(...channels),low=Math.min(...channels),spread=high-low
    // Yuque's default foreground is often #0f1115 rather than pure black.
    const neutral=spread<=32||spread/Math.max(1,high)<.12
    if(neutral){if((high+low)/2>80&&(high+low)/2<208)result={foreground:TEXT_COLORS.gray}}
    else {
      const [r,g,b]=channels
      const raw=high===r?(g-b)/spread:high===g?(b-r)/spread+2:(r-g)/spread+4
      const hue=(raw*60+360)%360
      const color=hue<15||hue>=335?TEXT_COLORS.red:hue<45?TEXT_COLORS.orange:hue<75?TEXT_COLORS.yellow:hue<165?TEXT_COLORS.green:hue<250?TEXT_COLORS.blue:TEXT_COLORS.purple
      result={foreground:color,background:`rgba(${paletteRGB.get(color)!.join(',')},0.14)`}
    }
  }
  if(mapped.size>=512)mapped.clear()
  mapped.set(key,result);return result
}
