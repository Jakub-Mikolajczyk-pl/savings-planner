import { parseCurrencyInput } from '../currency'
import type { EmlHeaders } from './eml'
import type { ParsedLine, ParsedOrder } from '../types'

const POLISH_MONTHS: Record<string, string> = {
  stycznia: '01', lutego: '02', marca: '03', kwietnia: '04',
  maja: '05', czerwca: '06', lipca: '07', sierpnia: '08',
  września: '09', października: '10', listopada: '11', grudnia: '12',
}

function parseDate2025(textBody: string): string {
  const m = textBody.match(/Data:\s*(\d{2})\.(\d{2})\.(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return ''
}

function parseDate2022(textBody: string): string {
  const m = textBody.match(/Dnia\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i)
  if (!m) return ''
  const day = m[1].padStart(2, '0')
  const month = POLISH_MONTHS[m[2].toLowerCase()]
  return month ? `${m[3]}-${month}-${day}` : ''
}

function parseOrderRef(textBody: string): string {
  const m = textBody.match(/(?:Numer|Nr) zam[oó]wienia:\s*([\w-]+)/i)
  return m?.[1] ?? ''
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Lisek-2025: table[data-type="code"], 4 tds per row ───────────────────────
function parseLines2025(doc: Document): ParsedLine[] {
  const table = doc.querySelector('[data-type="code"]')
  if (!table) return []

  const lines: ParsedLine[] = []
  for (const tr of Array.from(table.querySelectorAll('tr'))) {
    const tds = Array.from(tr.children).filter((el): el is HTMLTableCellElement => el.tagName === 'TD')
    if (tds.length < 4) continue

    const name = tds[1].textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (!name) continue

    const qtyText = tds[2].textContent?.trim() ?? ''
    const qtyMatch = qtyText.match(/^(\d+)/)
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1

    const lineTotal = parseCurrencyInput(tds[3].textContent ?? '')
    if (lineTotal === null || lineTotal === 0) continue

    lines.push({
      rawName: name,
      quantity,
      unitPrice: round2(lineTotal / quantity),
      lineTotal,
      isWeightItem: false,
    })
  }
  return lines
}

// ── Lisek "dostarczone": generic 4-td rows, qty cell like "1 szt." ───────────
// Same column layout as the 2025 template (name / qty / total) but the table
// carries no data-type="code" marker, so it is matched by the qty cell shape.
function parseLinesSzt(doc: Document): ParsedLine[] {
  const lines: ParsedLine[] = []

  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const tds = Array.from(tr.children).filter((el): el is HTMLTableCellElement => el.tagName === 'TD')
    if (tds.length < 4) continue

    const qtyText = tds[2].textContent?.trim() ?? ''
    const qtyMatch = qtyText.match(/^(\d+)\s*szt/i)
    if (!qtyMatch) continue

    const name = tds[1].textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (!name) continue

    const quantity = parseInt(qtyMatch[1], 10)
    const lineTotal = parseCurrencyInput(tds[3].textContent ?? '')
    if (lineTotal === null || lineTotal === 0) continue

    lines.push({
      rawName: name,
      quantity,
      unitPrice: round2(lineTotal / quantity),
      lineTotal,
      isWeightItem: false,
    })
  }
  return lines
}

// ── Lisek-2022: rows with <strong>N x</strong> in first td ───────────────────
function parseLines2022(doc: Document): ParsedLine[] {
  const lines: ParsedLine[] = []

  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const tds = Array.from(tr.children).filter((el): el is HTMLTableCellElement => el.tagName === 'TD')
    if (tds.length < 3) continue

    const firstText = (tds[0].textContent ?? '').replace(/\s+/g, ' ').trim()
    const qtyMatch = firstText.match(/^(\d+)\s*x$/i)
    if (!qtyMatch) continue

    const quantity = parseInt(qtyMatch[1], 10)
    const name = tds[1].textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (!name) continue

    const lineTotal = parseCurrencyInput(tds[2].textContent ?? '')
    if (lineTotal === null || lineTotal === 0) continue

    lines.push({
      rawName: name,
      quantity,
      unitPrice: round2(lineTotal / quantity),
      lineTotal,
      isWeightItem: false,
    })
  }
  return lines
}

export function parseLisek(doc: Document, textBody: string, headers: EmlHeaders): ParsedOrder {
  // ── Order ref ─────────────────────────────────────────────────────────────────
  const orderRef = parseOrderRef(textBody)
  if (!orderRef) {
    return { ok: false, reason: 'parse_error', detail: 'orderRef not found in text body' }
  }

  // ── Date ─────────────────────────────────────────────────────────────────────
  // Try the explicit "Data:" line, then the 2022 prose form, then the email
  // header. The header fallback is guarded so a missing/invalid Date can't throw.
  const headerDate = (() => {
    const d = new Date(headers['date'] ?? '')
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
  })()
  const date = parseDate2025(textBody) || parseDate2022(textBody) || headerDate

  // ── Lines ─────────────────────────────────────────────────────────────────────
  // Templates seen in the wild, tried most-specific first:
  //   • data-type="code" table        → parseLines2025
  //   • generic table, "N szt." qty    → parseLinesSzt  ("dostarczone")
  //   • "N x" prefix in first cell      → parseLines2022
  let lines = parseLines2025(doc)
  if (lines.length === 0) lines = parseLinesSzt(doc)
  if (lines.length === 0) lines = parseLines2022(doc)

  if (lines.length === 0) {
    return { ok: false, reason: 'no_items' }
  }

  return { ok: true, store: 'lisek', orderRef, date, lines }
}
