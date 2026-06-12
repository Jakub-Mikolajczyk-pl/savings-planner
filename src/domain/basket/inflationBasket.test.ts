import { describe, it, expect } from 'vitest'
import {
  monthOf,
  ingestOrders,
  personalCpiSeries,
  itemTrend,
  topMovers,
  detectShrinkflation,
  cpiYoY,
  cpiYoYSeries,
} from './inflationBasket'
import type { BasketItem, PriceObservation, BasketConfig, ParsedOrder } from '../types'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const defaultConfig: BasketConfig = {
  method: 'laspeyres',
  trackingThreshold: 3,
  excludeWeightItems: true,
}

function makeItem(id: string, overrides: Partial<BasketItem> = {}): BasketItem {
  return {
    id,
    normalizedName: id,
    displayName: id,
    unit: 'szt',
    kind: 'food',
    tracked: true,
    aliases: [],
    ...overrides,
  }
}

function makeObs(
  id: string,
  itemId: string,
  date: string,
  unitPrice: number,
  quantity = 1,
  overrides: Partial<PriceObservation> = {},
): PriceObservation {
  return {
    id,
    itemId,
    date,
    store: 'frisco',
    unitPrice,
    quantity,
    isWeightItem: false,
    orderRef: `ord-${id}`,
    source: 'email',
    ...overrides,
  }
}

// ─── monthOf ─────────────────────────────────────────────────────────────────

describe('monthOf', () => {
  it('extracts YYYY-MM from ISO date', () => {
    expect(monthOf('2022-03-15')).toBe('2022-03')
  })
})

// ─── ingestOrders ─────────────────────────────────────────────────────────────

describe('ingestOrders', () => {
  const order: ParsedOrder = {
    ok: true,
    store: 'frisco',
    orderRef: 'ORD-X',
    date: '2022-01-10',
    lines: [
      { rawName: 'PIĄTNICA Serek wiejski bez laktozy 200g', quantity: 2, unitPrice: 3.5, lineTotal: 7.0, isWeightItem: false },
      { rawName: 'DAWTONA Pomidory krojone 400g', quantity: 3, unitPrice: 2.1, lineTotal: 6.3, isWeightItem: false },
    ],
  }

  it('tworzy nowe itemy i obserwacje', () => {
    const { items, observations, stats } = ingestOrders([order], { items: [], observations: [] })
    expect(stats.ordersParsed).toBe(1)
    expect(stats.itemsNew).toBe(2)
    expect(stats.observationsAdded).toBe(2)
    expect(stats.observationsDuplicate).toBe(0)
    expect(items).toHaveLength(2)
    expect(observations).toHaveLength(2)
  })

  it('normalizuje nazwy poprawnie', () => {
    const { items } = ingestOrders([order], { items: [], observations: [] })
    const serek = items.find(i => i.normalizedName === 'piątnica serek wiejski bez laktozy')
    expect(serek).toBeDefined()
    expect(serek!.unit).toBe('g')
    expect(serek!.packageSize).toBe(200)
  })

  it('oblicza normalizedUnitPrice (zł/kg)', () => {
    const { observations, items } = ingestOrders([order], { items: [], observations: [] })
    const serek = items.find(i => i.normalizedName === 'piątnica serek wiejski bez laktozy')!
    const obs = observations.find(o => o.itemId === serek.id)!
    // 3.5 / (200/1000) = 3.5 / 0.2 = 17.50 zł/kg
    expect(obs.normalizedUnitPrice).toBe(17.5)
  })

  it('dedupe: ponowny import tego samego orderRef → obserwacje nie dublują się', () => {
    const first = ingestOrders([order], { items: [], observations: [] })
    const second = ingestOrders([order], { items: first.items, observations: first.observations })
    expect(second.stats.observationsDuplicate).toBe(2)
    expect(second.stats.observationsAdded).toBe(0)
    expect(second.stats.itemsNew).toBe(0)
    expect(second.observations).toHaveLength(2)
  })

  it('dedupe: różne orderRef → nowe obserwacje są dodawane', () => {
    const order2: ParsedOrder = {
      ...order,
      orderRef: 'ORD-Y',
      date: '2022-02-10',
    }
    const first = ingestOrders([order], { items: [], observations: [] })
    const second = ingestOrders([order2], { items: first.items, observations: first.observations })
    expect(second.stats.observationsAdded).toBe(2)
    expect(second.observations).toHaveLength(4)
  })

  it('auto-tracking: item śledzone gdy ≥ trackingThreshold obserwacji', () => {
    const orders: ParsedOrder[] = Array.from({ length: 3 }, (_, i) => ({
      ok: true as const,
      store: 'frisco' as const,
      orderRef: `ORD-${i}`,
      date: `2022-0${i + 1}-10`,
      lines: [{ rawName: 'MLEKO UHT 1l', quantity: 1, unitPrice: 3.0, lineTotal: 3.0, isWeightItem: false }],
    }))

    const after1 = ingestOrders([orders[0]], { items: [], observations: [] }, 3)
    expect(after1.items[0].tracked).toBe(false)

    const after3 = ingestOrders(orders, { items: [], observations: [] }, 3)
    expect(after3.items[0].tracked).toBe(true)
  })

  it('trackedManual=false wyłącza śledzenie mimo progu', () => {
    const order2: ParsedOrder = { ...order, orderRef: 'ORD-2', date: '2022-02-01' }
    const order3: ParsedOrder = { ...order, orderRef: 'ORD-3', date: '2022-03-01' }
    const { items, observations } = ingestOrders([order, order2, order3], { items: [], observations: [] }, 3)
    // manually disable tracking for first item
    items[0].trackedManual = false
    const result = ingestOrders([], { items, observations }, 3)
    expect(result.items[0].tracked).toBe(false)
  })

  it('ignoruje zamówienia z ok:false', () => {
    const bad: ParsedOrder = { ok: false, reason: 'unknown_vendor' }
    const { stats } = ingestOrders([bad], { items: [], observations: [] })
    expect(stats.ordersParsed).toBe(0)
    expect(stats.itemsNew).toBe(0)
  })
})

// ─── personalCpiSeries – Laspeyres 2-produktowy ───────────────────────────────

describe('personalCpiSeries – Laspeyres', () => {
  // Mleko: base 3.00 × 4 = 12, Chleb: base 4.00 × 2 = 8. Denominator = 20.
  // 2022-03: mleko 3.30 × 4 = 13.2, chleb 4.40 × 2 = 8.8. Numerator = 22. Index = 1.1.
  const mleko = makeItem('mleko', { unit: 'l', packageSize: 1 })
  const chleb = makeItem('chleb', { unit: 'g', packageSize: 500 })
  const items = [mleko, chleb]

  const observations: PriceObservation[] = [
    makeObs('o1', 'mleko', '2022-01-05', 3.0, 4, { orderRef: 'A' }),
    makeObs('o2', 'chleb', '2022-01-05', 4.0, 2, { orderRef: 'A' }),
    makeObs('o3', 'mleko', '2022-03-05', 3.3, 4, { orderRef: 'B' }),
    makeObs('o4', 'chleb', '2022-03-05', 4.4, 2, { orderRef: 'B' }),
  ]

  const series = personalCpiSeries(items, observations, defaultConfig)

  it('zwraca miesiące od bazy do ostatniej obserwacji', () => {
    expect(series.map(p => p.month)).toEqual(['2022-01', '2022-02', '2022-03'])
  })

  it('base period index = 1.0', () => {
    expect(series[0].month).toBe('2022-01')
    expect(series[0].index).toBeCloseTo(1.0, 5)
    expect(series[0].valuePct).toBeCloseTo(0, 5)
  })

  it('indeks 2022-03 = 1.10 (+10%)', () => {
    // Numerator = 3.30*4 + 4.40*2 = 22; denominator = 20 → 1.1
    const march = series.find(p => p.month === '2022-03')!
    expect(march.index).toBeCloseTo(1.1, 5)
    expect(march.valuePct).toBeCloseTo(10, 1)
  })
})

// ─── personalCpiSeries – carry-forward ───────────────────────────────────────

describe('personalCpiSeries – carry-forward', () => {
  // Chleb nie kupowany w 2022-02 ani 2022-03 → cena carry-forward z bazy (4.00).
  const mleko = makeItem('mleko')
  const chleb = makeItem('chleb')

  const observations: PriceObservation[] = [
    makeObs('o1', 'mleko', '2022-01-05', 3.0, 4, { orderRef: 'A' }),
    makeObs('o2', 'chleb', '2022-01-05', 4.0, 2, { orderRef: 'A' }),
    makeObs('o3', 'mleko', '2022-02-05', 3.15, 4, { orderRef: 'B' }),
    makeObs('o4', 'mleko', '2022-03-05', 3.3, 4, { orderRef: 'C' }),
  ]

  const series = personalCpiSeries([mleko, chleb], observations, defaultConfig)

  it('zwraca 3 miesiące', () => {
    expect(series).toHaveLength(3)
  })

  it('2022-02: chleb na poziomie bazowym (carry-forward)', () => {
    // Denominator = 3.0*4 + 4.0*2 = 20
    // 2022-02: numerator = 3.15*4 + 4.0*2 = 12.6 + 8 = 20.6 → index = 1.03
    const p = series.find(s => s.month === '2022-02')!
    expect(p.index).toBeCloseTo(1.03, 2)
  })

  it('2022-03: chleb dalej carry-forward', () => {
    // 3.3*4 + 4.0*2 = 13.2 + 8 = 21.2 → index = 1.06
    const p = series.find(s => s.month === '2022-03')!
    expect(p.index).toBeCloseTo(1.06, 2)
  })

  it('emituje puste miesiące między zakupami, żeby r/r miało punkt odniesienia', () => {
    const item = makeItem('mleko')
    const sparse = [
      makeObs('s1', 'mleko', '2022-01-05', 4.0, 2, { orderRef: 'A' }),
      makeObs('s2', 'mleko', '2022-03-05', 4.4, 2, { orderRef: 'B' }),
    ]

    const sparseSeries = personalCpiSeries([item], sparse, defaultConfig)

    expect(sparseSeries.map(p => p.month)).toEqual(['2022-01', '2022-02', '2022-03'])
    expect(sparseSeries.find(p => p.month === '2022-02')?.index).toBeCloseTo(1, 5)
  })
})

// ─── personalCpiSeries – spend_weighted ───────────────────────────────────────

describe('personalCpiSeries – spend_weighted', () => {
  const item = makeItem('produkt', { unit: 'l', packageSize: 1 })
  // 3 obs in base, 1 obs in month 2 at higher price
  const observations: PriceObservation[] = [
    makeObs('o1', 'produkt', '2022-01-05', 5.0, 2, { orderRef: 'A' }),
    makeObs('o2', 'produkt', '2022-02-05', 6.0, 2, { orderRef: 'B' }),
    makeObs('o3', 'produkt', '2022-03-05', 6.0, 2, { orderRef: 'C' }),
  ]
  const cfg: BasketConfig = { ...defaultConfig, method: 'spend_weighted' }
  const series = personalCpiSeries([item], observations, cfg)

  it('zwraca punkty', () => {
    expect(series.length).toBeGreaterThan(0)
  })

  it('indeks rośnie po wzroście ceny', () => {
    const last = series[series.length - 1]
    expect(last.index).toBeGreaterThan(1)
  })
})

// ─── personalCpiSeries – excludeWeightItems ───────────────────────────────────

describe('personalCpiSeries – excludeWeightItems', () => {
  const item = makeItem('marchew', { unit: 'g', packageSize: 500 })
  const observations: PriceObservation[] = [
    makeObs('o1', 'marchew', '2022-01-05', 2.0, 1, { orderRef: 'A', isWeightItem: true }),
    makeObs('o2', 'marchew', '2022-02-05', 3.0, 1, { orderRef: 'B', isWeightItem: true }),
  ]

  it('pomija produkty wagowe gdy excludeWeightItems=true', () => {
    const series = personalCpiSeries([item], observations, defaultConfig)
    expect(series).toHaveLength(0)
  })

  it('uwzględnia produkty wagowe gdy excludeWeightItems=false', () => {
    const series = personalCpiSeries([item], observations, { ...defaultConfig, excludeWeightItems: false })
    expect(series.length).toBeGreaterThan(0)
  })
})

// ─── itemTrend ────────────────────────────────────────────────────────────────

describe('itemTrend', () => {
  const obs: PriceObservation[] = [
    makeObs('o1', 'A', '2021-01-10', 5.0, 1, { orderRef: 'R1' }),
    makeObs('o2', 'A', '2022-06-10', 6.0, 1, { orderRef: 'R2' }),
    makeObs('o3', 'A', '2023-01-10', 7.0, 1, { orderRef: 'R3' }),
  ]

  const trend = itemTrend('A', obs)

  it('zwraca 3 punkty posortowane chronologicznie', () => {
    expect(trend.points).toHaveLength(3)
    expect(trend.points[0].unitPrice).toBe(5.0)
    expect(trend.points[2].unitPrice).toBe(7.0)
  })

  it('deltaVsBasePct = (7/5 - 1) * 100 = 40%', () => {
    expect(trend.deltaVsBasePct).toBeCloseTo(40, 1)
  })

  it('deltaVsLastBuyPct = (7/6 - 1) * 100 ≈ 16.67%', () => {
    expect(trend.deltaVsLastBuyPct).toBeCloseTo(16.67, 1)
  })

  it('brak obserwacji → puste punkty bez delt', () => {
    const t = itemTrend('nieznany', obs)
    expect(t.points).toHaveLength(0)
    expect(t.deltaVsBasePct).toBeUndefined()
  })

  it('jedna obserwacja → brak delt', () => {
    const t = itemTrend('A', [obs[0]])
    expect(t.points).toHaveLength(1)
    expect(t.deltaVsBasePct).toBeUndefined()
  })
})

// ─── topMovers ────────────────────────────────────────────────────────────────

describe('topMovers', () => {
  const mleko = makeItem('mleko')
  const chleb = makeItem('chleb')
  const observations: PriceObservation[] = [
    makeObs('o1', 'mleko', '2022-01-05', 3.0, 4, { orderRef: 'A' }),
    makeObs('o2', 'chleb', '2022-01-05', 4.0, 2, { orderRef: 'A' }),
    makeObs('o3', 'mleko', '2022-06-05', 4.5, 4, { orderRef: 'B' }),   // +50%
    makeObs('o4', 'chleb', '2022-06-05', 4.4, 2, { orderRef: 'B' }),   // +10%
  ]

  const movers = topMovers([mleko, chleb], observations, defaultConfig, 5)

  it('zwraca movers posortowane malejąco po contributionPct', () => {
    expect(movers[0].itemId).toBe('mleko') // mleko = (4.5-3)*4/20*100 = +30
    expect(movers[1].itemId).toBe('chleb') // chleb = (4.4-4)*2/20*100 = +4
  })

  it('mleko contributionPct ≈ 30', () => {
    expect(movers[0].contributionPct).toBeCloseTo(30, 1)
  })

  it('mleko priceChangePct ≈ 50', () => {
    expect(movers[0].priceChangePct).toBeCloseTo(50, 1)
  })

  it('limit n działa', () => {
    const top1 = topMovers([mleko, chleb], observations, defaultConfig, 1)
    expect(top1).toHaveLength(1)
  })

  it('brak tracked items → []', () => {
    const untracked = [makeItem('x', { tracked: false }), makeItem('y', { tracked: false })]
    expect(topMovers(untracked, observations, defaultConfig, 5)).toHaveLength(0)
  })
})

// ─── detectShrinkflation ──────────────────────────────────────────────────────

describe('detectShrinkflation', () => {
  // Classic case: 1l → 0.9l, same price → effective +11%
  const juice = makeItem('sok', { unit: 'l', packageSize: 1.0 })

  const obs1: PriceObservation = makeObs('s1', 'sok', '2022-01-05', 9.98, 1, {
    orderRef: 'R1',
    normalizedUnitPrice: 9.98, // 9.98/l (1l bottle)
  })
  const obs2: PriceObservation = makeObs('s2', 'sok', '2023-01-05', 9.98, 1, {
    orderRef: 'R2',
    normalizedUnitPrice: 11.09, // ≈9.98/0.9l (0.9l bottle)
  })

  it('wykrywa shrinkflację (1l→0.9l, ta sama cena → +11%)', () => {
    const cases = detectShrinkflation([juice], [obs1, obs2])
    expect(cases).toHaveLength(1)
    expect(cases[0].itemId).toBe('sok')
    expect(cases[0].effectivePriceChangePct).toBeCloseTo(11, 0)
  })

  it('fromSize ≈ 1.0l, toSize ≈ 0.9l', () => {
    const cases = detectShrinkflation([juice], [obs1, obs2])
    expect(cases[0].fromSize).toBeCloseTo(1.0, 1)
    expect(cases[0].toSize).toBeCloseTo(0.9, 1)
  })

  it('czysta inflacja (cena rośnie, rozmiar stały) → nie wykrywa', () => {
    // Same normalizedUnitPrice ratio as unitPrice → no shrinkflation
    const o1 = makeObs('n1', 'sok', '2022-01-05', 9.98, 1, { orderRef: 'R1', normalizedUnitPrice: 9.98 })
    const o2 = makeObs('n2', 'sok', '2022-06-05', 11.09, 1, { orderRef: 'R2', normalizedUnitPrice: 11.09 })
    const cases = detectShrinkflation([juice], [o1, o2])
    // effective change ≈ same as price change → no shrinkflation
    expect(cases).toHaveLength(0)
  })

  it('produkt bez normalizedUnitPrice (szt) → pomija', () => {
    const item = makeItem('item-szt', { unit: 'szt' })
    const o1 = makeObs('x1', 'item-szt', '2022-01-05', 5.0, 1, { orderRef: 'R1' })
    const o2 = makeObs('x2', 'item-szt', '2022-06-05', 8.0, 1, { orderRef: 'R2' })
    expect(detectShrinkflation([item], [o1, o2])).toHaveLength(0)
  })

  it('mniej niż 2 obserwacje → pomija', () => {
    const cases = detectShrinkflation([juice], [obs1])
    expect(cases).toHaveLength(0)
  })
})

// ─── cpiYoY ───────────────────────────────────────────────────────────────────

describe('cpiYoY', () => {
  const series = [
    { month: '2022-01', index: 1.0, valuePct: 0 },
    { month: '2022-06', index: 1.05, valuePct: 5 },
    { month: '2023-01', index: 1.12, valuePct: 12 },
  ]

  it('najnowszy vs 12 mies. wcześniej = 12%', () => {
    // latest=2023-01 (1.12), base=2022-01 (1.0) → (1.12/1.0-1)*100 = 12
    expect(cpiYoY(series)).toBeCloseTo(12, 1)
  })

  it('brak danych sprzed roku → undefined', () => {
    const short = [{ month: '2022-06', index: 1.05, valuePct: 5 }]
    expect(cpiYoY(short)).toBeUndefined()
  })

  it('pusta seria → undefined', () => {
    expect(cpiYoY([])).toBeUndefined()
  })

  it('liczy najnowsze r/r z serii z miesiącami uzupełnionymi carry-forward', () => {
    const item = makeItem('mleko')
    const sparse = [
      makeObs('y1', 'mleko', '2022-01-05', 10, 1, { orderRef: 'A' }),
      makeObs('y2', 'mleko', '2023-03-05', 11, 1, { orderRef: 'B' }),
    ]

    const sparseSeries = personalCpiSeries([item], sparse, defaultConfig)

    expect(sparseSeries.map(p => p.month)).toContain('2022-03')
    expect(cpiYoY(sparseSeries)).toBeCloseTo(10, 1)
  })
})

describe('cpiYoYSeries', () => {
  it('zwraca miesięczną serię r/r porównywalną z GUS officialCpi', () => {
    const series = [
      { month: '2022-01', index: 1.0, valuePct: 0 },
      { month: '2022-02', index: 1.0, valuePct: 0 },
      { month: '2023-01', index: 1.1, valuePct: 10 },
      { month: '2023-02', index: 1.2, valuePct: 20 },
    ]

    expect(cpiYoYSeries(series)).toEqual([
      { month: '2023-01', valuePct: 10 },
      { month: '2023-02', valuePct: 20 },
    ])
  })
})
