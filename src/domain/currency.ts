const roundToGrosze = (value: number): number => Math.round(value * 100) / 100

export function formatCurrencyInput(value: number): string {
  /*
   * Avoid Intl here. Some CI/act Node runtimes have limited ICU data and silently
   * fall back from pl-PL to en-US, which formats 1234.5 as "1,234.50".
   */
  const amount = Number.isFinite(value) ? value : 0
  const sign = amount < 0 ? '-' : ''
  const [whole, grosze] = Math.abs(amount).toFixed(2).split('.')
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${sign}${groupedWhole},${grosze}`
}

export function sanitizeCurrencyInput(raw: string): string {
  return raw.replace(/[^\d\s,.]/g, '')
}

export function parseCurrencyInput(raw: string): number | null {
  const compact = sanitizeCurrencyInput(raw).replace(/[\s\u00a0]/g, '')
  if (!/\d/.test(compact)) return null

  const lastComma = compact.lastIndexOf(',')
  const lastDot = compact.lastIndexOf('.')
  const hasComma = lastComma !== -1
  const hasDot = lastDot !== -1
  let decimalIndex = -1

  if (hasComma && hasDot) {
    decimalIndex = Math.max(lastComma, lastDot)
  } else if (hasComma || hasDot) {
    const separatorIndex = hasComma ? lastComma : lastDot
    const digitsAfterSeparator = compact.length - separatorIndex - 1
    decimalIndex = digitsAfterSeparator > 0 && digitsAfterSeparator <= 2 ? separatorIndex : -1
  }

  const wholePart = (decimalIndex === -1 ? compact : compact.slice(0, decimalIndex)).replace(/\D/g, '')
  const decimalPart = decimalIndex === -1
    ? ''
    : compact.slice(decimalIndex + 1).replace(/\D/g, '').slice(0, 2)

  if (!wholePart && !decimalPart) return null

  return roundToGrosze(Number(`${wholePart || '0'}${decimalPart ? `.${decimalPart}` : ''}`))
}
