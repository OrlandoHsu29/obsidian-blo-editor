/** Small text-and-arrow symbols stay legible at toolbar size. */
export function replacementIcon(all: boolean): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${all ? 2 : 0} 28 24" fill="none" aria-hidden="true"><g fill="currentColor" font-family="Arial,sans-serif" font-size="15"><text x="1" y="16">a</text><text x="19" y="16">b</text></g><path d="M11 11h7m-3-3 3 3-3 3${all ? 'M3 20h22M3 23h22' : ''}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}
