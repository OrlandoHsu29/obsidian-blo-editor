/** An intentional blank label is one space; only an untouched field is empty. */
export function normalizeLinkLabel(value: string): string {
  const label = value.replace(/\s+/gu, ' ')
  return label.trim() || (label.length ? ' ' : '')
}

export const isSpaceOnlyLinkLabel = (value: string) => normalizeLinkLabel(value) === ' '
