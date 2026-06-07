import { parseCurrencyInput } from '../currency'
import type { EmlHeaders } from './eml'
import type { ParsedLine, ParsedOrder } from '../types'

const PRICE_RE = /\d[\d\s]*,\d{2}\s*zł/

function findLabelSiblingText(doc: Document, labelPattern: RegExp): string {
  const tds = Array.from(doc.querySelectorAll('td'))
  const labelTd = tds.find(td => !td.querySelector('td') && labelPattern.test(td.textContent?.trim() ?? ''))
  if (!labelTd) return ''
  // look for the next <td> sibling within the same <tr>
  const row = labelTd.closest('tr')
  if (!row) return ''
  const rowTds = Array.from(row.querySelectorAll('td'))
  const idx = rowTds.indexOf(labelTd as HTMLTableCellElement)
  return rowTds[idx + 1]?.textContent?.trim() ?? ''
}

function extractDate(doc: Document, fallbackDateHeader: string): string {
  const deliveryText = findLabelSiblingText(doc, /Termin dostawy/)
  const m = deliveryText.match(/(\d{2})\.(\d{2})\.(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`

  // Fallback: parse RFC-2822 Date header ("Mon, 29 Mar 2021 05:32:10 +0200")
  const d = new Date(fallbackDateHeader)
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  return ''
}

export function parseFrisco(doc: Document, headers: EmlHeaders): ParsedOrder {
  // ── Order ref ────────────────────────────────────────────────────────────────
  const orderRef = findLabelSiblingText(doc, /Numer zam[oó]wienia/)
  if (!orderRef) {
    return { ok: false, reason: 'parse_error', detail: 'orderRef not found' }
  }

  // ── Date ─────────────────────────────────────────────────────────────────────
  const date = extractDate(doc, headers['date'] ?? '')

  // ── Product rows ──────────────────────────────────────────────────────────────
  const lines: ParsedLine[] = []

  const productRows = Array.from(doc.querySelectorAll('.products tr')).filter(tr =>
    tr.querySelector('td.prodimg'),
  )

  for (const tr of productRows) {
    const tds = Array.from(tr.querySelectorAll('td'))
    const prodimgIdx = tds.findIndex(td => td.classList.contains('prodimg'))
    if (prodimgIdx === -1) continue

    const name = tds[prodimgIdx + 1]?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (!name) continue

    // All tds whose text matches a price pattern (handles both 2026 and 2021+VAT layouts)
    const priceTds = tds.filter(td => PRICE_RE.test(td.textContent ?? ''))
    if (priceTds.length < 1) continue

    const unitPriceRaw = parseCurrencyInput(priceTds[0].textContent ?? '')
    const lineTotalRaw = parseCurrencyInput(priceTds[priceTds.length - 1].textContent ?? '')
    if (unitPriceRaw === null || lineTotalRaw === null) continue

    // Skip freebies / bags (0,00 zł)
    if (unitPriceRaw === 0) continue

    // Quantity: td between prodimg+1 and first price whose trimmed text is a pure integer
    const qtyText = tds[prodimgIdx + 2]?.textContent?.trim() ?? '1'
    const quantity = /^\d+$/.test(qtyText) ? parseInt(qtyText, 10) : 1

    // Weight item: weight td has <img>
    const weightTd = tds.find(td => td.classList.contains('weight'))
    const isWeightItem = !!(weightTd?.querySelector('img'))

    lines.push({
      rawName: name,
      quantity,
      unitPrice: unitPriceRaw,
      lineTotal: lineTotalRaw,
      isWeightItem,
    })
  }

  if (lines.length === 0) {
    return { ok: false, reason: 'no_items' }
  }

  return { ok: true, store: 'frisco', orderRef, date, lines }
}
