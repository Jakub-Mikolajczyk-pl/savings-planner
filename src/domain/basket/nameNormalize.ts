export interface NameNormalization {
  normalizedName: string
  displayName: string
  brand?: string
  packageSize?: number
  unit: 'g' | 'kg' | 'ml' | 'l' | 'szt'
}

const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|szt)\b/gi

function extractBrand(rawName: string): string | undefined {
  // Leading uppercase tokens (no lowercase letter) form the brand
  const tokens = rawName.split(/\s+/)
  const brandTokens: string[] = []
  for (const token of tokens) {
    if (!token) continue
    // Stop at first token containing a lowercase letter
    if (/[a-ząęóśźżńćł]/.test(token)) break
    brandTokens.push(token)
  }
  return brandTokens.length > 0 ? brandTokens.join(' ') : undefined
}

export function normalizeName(rawName: string): NameNormalization {
  const displayName = rawName.trim()

  // Find last package size match
  let lastMatch: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  const re = new RegExp(SIZE_RE.source, 'gi')
  while ((m = re.exec(rawName)) !== null) {
    lastMatch = m
  }

  let packageSize: number | undefined
  let unit: 'g' | 'kg' | 'ml' | 'l' | 'szt' = 'szt'

  if (lastMatch) {
    packageSize = parseFloat(lastMatch[1].replace(',', '.'))
    unit = lastMatch[2].toLowerCase() as 'g' | 'kg' | 'ml' | 'l' | 'szt'
  }

  // Remove the last size token to build normalizedName
  let stripped = rawName
  if (lastMatch) {
    stripped = rawName.slice(0, lastMatch.index) + rawName.slice(lastMatch.index + lastMatch[0].length)
  }

  // Lowercase, remove punctuation (keep Unicode letters, digits, whitespace), collapse spaces
  const normalizedName = stripped
    .toLowerCase()
    .replace(/[^\p{L}\d\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const brand = extractBrand(rawName)

  return { normalizedName, displayName, brand, packageSize, unit }
}
