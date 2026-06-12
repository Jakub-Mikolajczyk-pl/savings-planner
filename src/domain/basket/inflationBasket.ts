import { createId } from '../id'
import { addMonths, monthDiff } from '../formatting'
import { normalizeName } from './nameNormalize'
import type { BasketItem, BasketConfig, PriceObservation, ParsedOrder } from '../types'

// ─── exported types ───────────────────────────────────────────────────────────

export interface IngestStats {
  ordersParsed: number
  itemsNew: number
  observationsAdded: number
  observationsDuplicate: number
}

export interface CpiPoint {
  month: string    // "YYYY-MM"
  index: number    // 1.0 at base period
  valuePct: number // (index - 1) * 100
}

export interface CpiYoYPoint {
  month: string
  valuePct: number
}

export interface ItemTrend {
  points: { date: string; unitPrice: number }[]
  deltaVsBasePct?: number
  deltaVsLastBuyPct?: number
}

export interface TopMover {
  itemId: string
  displayName: string
  contributionPct: number
  priceChangePct: number
}

export interface ShrinkflationCase {
  itemId: string
  fromSize: number
  toSize: number
  effectivePriceChangePct: number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

function r2(value: number): number {
  return Math.round(value * 100) / 100
}

function computeNormalizedUnitPrice(
  unitPrice: number,
  unit: 'g' | 'kg' | 'ml' | 'l' | 'szt',
  packageSize: number | undefined,
): number | undefined {
  if (!packageSize || unit === 'szt') return undefined
  if (unit === 'g' || unit === 'ml') return r2(unitPrice / (packageSize / 1000))
  // kg, l
  return r2(unitPrice / packageSize)
}

// Quantity-weighted average unit price across a set of observations.
function wavg(obs: PriceObservation[]): number {
  const totalQty = obs.reduce((s, o) => s + o.quantity, 0)
  return obs.reduce((s, o) => s + o.unitPrice * o.quantity, 0) / totalQty
}

function monthRange(from: string, to: string): string[] {
  const diff = monthDiff(from, to)
  if (diff < 0) return []
  return Array.from({ length: diff + 1 }, (_, i) => addMonths(from, i))
}

// ─── ingest ──────────────────────────────────────────────────────────────────

export function ingestOrders(
  orders: ParsedOrder[],
  existing: { items: BasketItem[]; observations: PriceObservation[] },
  trackingThreshold = 3,
): { items: BasketItem[]; observations: PriceObservation[]; stats: IngestStats } {
  // Shallow-copy items so we don't mutate the caller's array objects.
  const items: BasketItem[] = existing.items.map(i => ({ ...i }))
  const observations: PriceObservation[] = [...existing.observations]
  const stats: IngestStats = { ordersParsed: 0, itemsNew: 0, observationsAdded: 0, observationsDuplicate: 0 }

  // normalizedName / alias → item index in `items`
  const byName = new Map<string, BasketItem>()
  for (const item of items) {
    byName.set(item.normalizedName, item)
    for (const alias of item.aliases) byName.set(alias, item)
  }

  // Dedupe: "orderRef::itemId" must be unique
  const dedupeSet = new Set<string>()
  for (const obs of observations) dedupeSet.add(`${obs.orderRef}::${obs.itemId}`)

  // Track the latest observation date seen per item (for displayName currency).
  const latestDate = new Map<string, string>()
  for (const obs of observations) {
    const prev = latestDate.get(obs.itemId)
    if (!prev || obs.date > prev) latestDate.set(obs.itemId, obs.date)
  }

  for (const order of orders) {
    if (!order.ok) continue
    stats.ordersParsed++

    for (const line of order.lines) {
      const norm = normalizeName(line.rawName)

      // ── find or create BasketItem ─────────────────────────────────────────
      let item = byName.get(norm.normalizedName)
      if (!item) {
        item = {
          id: createId(),
          normalizedName: norm.normalizedName,
          displayName: norm.displayName,
          brand: norm.brand,
          unit: norm.unit,
          packageSize: norm.packageSize,
          kind: 'food',
          tracked: false,
          aliases: [],
        }
        items.push(item)
        byName.set(norm.normalizedName, item)
        stats.itemsNew++
      } else {
        // Update metadata only when this order is at least as recent as last seen.
        const prev = latestDate.get(item.id)
        if (!prev || order.date >= prev) {
          item.displayName = norm.displayName
          if (norm.brand) item.brand = norm.brand
          if (norm.packageSize !== undefined) item.packageSize = norm.packageSize
          if (norm.unit !== 'szt') item.unit = norm.unit
        }
      }

      // ── dedupe ───────────────────────────────────────────────────────────
      const key = `${order.orderRef}::${item.id}`
      if (dedupeSet.has(key)) {
        stats.observationsDuplicate++
        continue
      }

      // Use per-line size data for normalizedUnitPrice so historical sizes are preserved.
      const normalizedUnitPrice = computeNormalizedUnitPrice(line.unitPrice, norm.unit, norm.packageSize)

      observations.push({
        id: createId(),
        itemId: item.id,
        date: order.date,
        store: order.store,
        unitPrice: line.unitPrice,
        normalizedUnitPrice,
        quantity: line.quantity,
        isWeightItem: line.isWeightItem,
        orderRef: order.orderRef,
        source: 'email',
      })
      dedupeSet.add(key)
      stats.observationsAdded++

      const prev = latestDate.get(item.id)
      if (!prev || order.date >= prev) latestDate.set(item.id, order.date)
    }
  }

  // Recompute `tracked` for all items based on current observation counts.
  const countPerItem = new Map<string, number>()
  for (const obs of observations) {
    countPerItem.set(obs.itemId, (countPerItem.get(obs.itemId) ?? 0) + 1)
  }
  for (const item of items) {
    const n = countPerItem.get(item.id) ?? 0
    // trackedManual overrides auto; null-coalescing skips only null/undefined (not false).
    item.tracked = item.trackedManual ?? n >= trackingThreshold
  }

  return { items, observations, stats }
}

// ─── CPI series ──────────────────────────────────────────────────────────────

export function personalCpiSeries(
  items: BasketItem[],
  observations: PriceObservation[],
  config: BasketConfig,
): CpiPoint[] {
  const trackedIds = new Set(items.filter(i => i.tracked).map(i => i.id))
  if (trackedIds.size === 0) return []

  const filteredObs = config.excludeWeightItems
    ? observations.filter(o => !o.isWeightItem)
    : observations

  // All months that have at least one observation from a tracked item.
  const monthsSet = new Set<string>()
  for (const obs of filteredObs) {
    if (trackedIds.has(obs.itemId)) monthsSet.add(monthOf(obs.date))
  }
  const observedMonths = [...monthsSet].sort()
  if (observedMonths.length === 0) return []

  const basePeriod = config.basePeriod ?? observedMonths[0]
  const months = monthRange(basePeriod, observedMonths[observedMonths.length - 1])
  if (months.length === 0) return []

  // Base quantities / effective weights per item.
  // Laspeyres: q0 = sum of quantities bought in basePeriod.
  // spend_weighted: q_eff = totalSpend / p0  (so p0 * q_eff = totalSpend, a spend-proportional weight).
  const baseData = new Map<string, { p0: number; q0eff: number }>()

  for (const id of trackedIds) {
    const baseObs = filteredObs.filter(o => o.itemId === id && monthOf(o.date) === basePeriod)
    if (baseObs.length === 0) continue
    const p0 = wavg(baseObs)

    let q0eff: number
    if (config.method === 'laspeyres') {
      q0eff = baseObs.reduce((s, o) => s + o.quantity, 0)
    } else {
      const totalSpend = filteredObs
        .filter(o => o.itemId === id)
        .reduce((s, o) => s + o.unitPrice * o.quantity, 0)
      q0eff = p0 > 0 ? totalSpend / p0 : 0
    }

    baseData.set(id, { p0, q0eff })
  }

  if (baseData.size === 0) return []

  // Laspeyres denominator: Σ p0 * q0eff
  const denominator = [...baseData.values()].reduce((s, { p0, q0eff }) => s + p0 * q0eff, 0)
  if (denominator === 0) return []

  // Carry-forward: start each item at its base price.
  const lastPrice = new Map<string, number>()
  for (const [id, { p0 }] of baseData) lastPrice.set(id, p0)

  const result: CpiPoint[] = []

  for (const month of months) {
    // Advance carry-forward for this month.
    for (const id of baseData.keys()) {
      const monthObs = filteredObs.filter(o => o.itemId === id && monthOf(o.date) === month)
      if (monthObs.length > 0) lastPrice.set(id, wavg(monthObs))
    }

    // Numerator: Σ p_t * q0eff
    const numerator = [...baseData.entries()].reduce((s, [id, { q0eff }]) => {
      return s + (lastPrice.get(id) ?? 0) * q0eff
    }, 0)

    const index = numerator / denominator
    result.push({ month, index, valuePct: r2((index - 1) * 100) })
  }

  return result
}

// ─── item trend ───────────────────────────────────────────────────────────────

export function itemTrend(itemId: string, observations: PriceObservation[]): ItemTrend {
  const sorted = observations
    .filter(o => o.itemId === itemId)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (sorted.length === 0) return { points: [] }

  const points = sorted.map(o => ({ date: o.date, unitPrice: o.unitPrice }))
  if (sorted.length < 2) return { points }

  const firstPrice = sorted[0].unitPrice
  const lastPrice = sorted[sorted.length - 1].unitPrice
  const prevPrice = sorted[sorted.length - 2].unitPrice

  return {
    points,
    deltaVsBasePct: r2((lastPrice / firstPrice - 1) * 100),
    deltaVsLastBuyPct: r2((lastPrice / prevPrice - 1) * 100),
  }
}

// ─── top movers ───────────────────────────────────────────────────────────────

export function topMovers(
  items: BasketItem[],
  observations: PriceObservation[],
  config: BasketConfig,
  n: number,
): TopMover[] {
  const filteredObs = config.excludeWeightItems
    ? observations.filter(o => !o.isWeightItem)
    : observations

  const monthsSet = new Set<string>()
  for (const obs of filteredObs) monthsSet.add(monthOf(obs.date))
  const months = [...monthsSet].sort()
  if (months.length === 0) return []

  const basePeriod = config.basePeriod ?? months[0]

  const baseData = new Map<string, { p0: number; q0eff: number; item: BasketItem }>()
  for (const item of items.filter(i => i.tracked)) {
    const baseObs = filteredObs.filter(o => o.itemId === item.id && monthOf(o.date) === basePeriod)
    if (baseObs.length === 0) continue
    const p0 = wavg(baseObs)
    let q0eff: number
    if (config.method === 'laspeyres') {
      q0eff = baseObs.reduce((s, o) => s + o.quantity, 0)
    } else {
      const totalSpend = filteredObs
        .filter(o => o.itemId === item.id)
        .reduce((s, o) => s + o.unitPrice * o.quantity, 0)
      q0eff = p0 > 0 ? totalSpend / p0 : 0
    }
    baseData.set(item.id, { p0, q0eff, item })
  }

  if (baseData.size === 0) return []

  const denominator = [...baseData.values()].reduce((s, { p0, q0eff }) => s + p0 * q0eff, 0)
  if (denominator === 0) return []

  // Advance carry-forward through all months to get current prices.
  const lastPrice = new Map<string, number>()
  for (const [id, { p0 }] of baseData) lastPrice.set(id, p0)
  for (const month of months) {
    for (const id of baseData.keys()) {
      const monthObs = filteredObs.filter(o => o.itemId === id && monthOf(o.date) === month)
      if (monthObs.length > 0) lastPrice.set(id, wavg(monthObs))
    }
  }

  const movers: TopMover[] = []
  for (const [id, { p0, q0eff, item }] of baseData) {
    const pt = lastPrice.get(id) ?? p0
    movers.push({
      itemId: id,
      displayName: item.displayName,
      priceChangePct: r2((pt / p0 - 1) * 100),
      // Contribution to index change in percentage points.
      contributionPct: r2((pt - p0) * q0eff / denominator * 100),
    })
  }

  return movers.sort((a, b) => b.contributionPct - a.contributionPct).slice(0, n)
}

// ─── shrinkflation ────────────────────────────────────────────────────────────

function inferSize(unitPrice: number, normalizedUnitPrice: number, unit: string): number {
  // normalizedUnitPrice is per kg (for g/kg) or per l (for ml/l).
  if (unit === 'g' || unit === 'ml') return r2((unitPrice / normalizedUnitPrice) * 1000)
  return r2(unitPrice / normalizedUnitPrice)
}

export function detectShrinkflation(
  items: BasketItem[],
  observations: PriceObservation[],
): ShrinkflationCase[] {
  const result: ShrinkflationCase[] = []

  for (const item of items) {
    const obs = observations
      .filter(o => o.itemId === item.id && o.normalizedUnitPrice != null && o.normalizedUnitPrice > 0)
      .sort((a, b) => a.date.localeCompare(b.date))

    if (obs.length < 2) continue

    const first = obs[0]
    const last = obs[obs.length - 1]
    const firstNorm = first.normalizedUnitPrice!
    const lastNorm = last.normalizedUnitPrice!

    const effectivePriceChangePct = r2((lastNorm / firstNorm - 1) * 100)
    // Package price change as a fraction (not percent) for the threshold comparison.
    const unitPriceChangeFrac = last.unitPrice / first.unitPrice - 1

    // Shrinkflation: effective per-unit price rose > 5pp more than the package price.
    if (effectivePriceChangePct > 5 && effectivePriceChangePct > unitPriceChangeFrac * 100 + 5) {
      result.push({
        itemId: item.id,
        fromSize: inferSize(first.unitPrice, firstNorm, item.unit),
        toSize: inferSize(last.unitPrice, lastNorm, item.unit),
        effectivePriceChangePct,
      })
    }
  }

  return result
}

// ─── year-over-year ───────────────────────────────────────────────────────────

export function cpiYoY(series: CpiPoint[]): number | undefined {
  return cpiYoYSeries(series).at(-1)?.valuePct
}

export function cpiYoYSeries(series: CpiPoint[]): CpiYoYPoint[] {
  const byMonth = new Map(series.map(p => [p.month, p]))
  const result: CpiYoYPoint[] = []

  for (const point of series) {
    const base = byMonth.get(addMonths(point.month, -12))
    if (!base || base.index === 0) continue
    result.push({
      month: point.month,
      valuePct: r2((point.index / base.index - 1) * 100),
    })
  }

  return result
}
