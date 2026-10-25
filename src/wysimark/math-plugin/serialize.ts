/** Dollar runs follow the standard inline-math delimiter rules. */
export function serializeMath(latex: string, display = false, inTable = false): string {
  // The table serializer adds the final escaping slash. Double existing
  // slashes before pipes so its cell separator remains escaped as well.
  if (inTable) latex = latex.replace(/(\\*)\|/g, (_, slashes: string) => slashes + slashes + '|')
  const runs = latex.match(/\$+/g) ?? []
  const delimiter = "$".repeat(Math.max(display ? 2 : 1, ...runs.map(run => run.length + 1)))
  if (display) return `${delimiter}\n${latex}\n${delimiter}\n\n`
  let value = latex.replace(/[\r\n]+/g, " ") || " "
  if (/[^ ]/.test(value) && ((/^ /.test(value) && / $/.test(value)) || /^\$|\$$/.test(value))) value = ` ${value} `
  return `${delimiter}${value}${delimiter}`
}
