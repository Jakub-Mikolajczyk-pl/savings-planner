import { parseEml } from './eml'
import { detectVendor } from './vendorDetect'
import { parseFrisco } from './friscoAdapter'
import { parseLisek } from './liskAdapter'
import type { ParsedOrder } from '../types'

export function parseOrderEmail(emlContent: string): ParsedOrder {
  const parsed = parseEml(emlContent)
  const vendor = detectVendor(parsed.headers)

  if (vendor === 'unknown') {
    return { ok: false, reason: 'unknown_vendor' }
  }

  const doc = new DOMParser().parseFromString(parsed.htmlBody, 'text/html')

  if (vendor === 'frisco') {
    return parseFrisco(doc, parsed.headers)
  } else {
    return parseLisek(doc, parsed.textBody ?? '', parsed.headers)
  }
}
