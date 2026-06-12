// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, basketOnlyPersistValue, readPersistedLocalState } from './index'
import { defaultBasketConfig } from '../domain/types'
import { parseOrderEmail } from '../domain/basket/parseOrderEmail'
import frisco2026 from '../domain/basket/__fixtures__/frisco-2026.eml?raw'
import frisco2021 from '../domain/basket/__fixtures__/frisco-2021.eml?raw'

function resetBasket() {
  useStore.setState({
    basketItems: [],
    priceObservations: [],
    basketConfig: defaultBasketConfig,
  })
}

function makeFile(content: string, name: string): File {
  return new File([content], name, { type: 'message/rfc822' })
}

describe('diagnostics', () => {
  it('parseOrderEmail działa w tym środowisku (jsdom)', () => {
    const r = parseOrderEmail(frisco2026)
    expect(r.ok).toBe(true)
  })

  it('FileReader.readAsText zwraca tę samą treść co ?raw import', async () => {
    const f = makeFile(frisco2026, 'test.eml')
    const content = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(r.error)
      r.readAsText(f, 'utf-8')
    })
    expect(content).toBe(frisco2026)
  })
})

describe('basket store slice', () => {
  beforeEach(resetBasket)

  // ─── importBasketEmails ───────────────────────────────────────────────────

  it('ingest 2 zamówień → tworzy produkty i obserwacje', async () => {
    const summary = await useStore.getState().importBasketEmails([
      makeFile(frisco2026, 'frisco-2026.eml'),
      makeFile(frisco2021, 'frisco-2021.eml'),
    ])
    const { basketItems, priceObservations } = useStore.getState()

    expect(summary.filesOk).toBe(2)
    expect(summary.ordersParsed).toBe(2)
    expect(basketItems.length).toBeGreaterThan(0)
    expect(priceObservations.length).toBeGreaterThan(0)
    expect(summary.observationsDuplicate).toBe(0)
    expect(summary.itemsNew).toBeGreaterThan(0)
  })

  it('ten sam plik dwa razy → 0 nowych obserwacji (dedupe po orderRef)', async () => {
    await useStore.getState().importBasketEmails([makeFile(frisco2026, 'frisco-2026.eml')])
    const firstCount = useStore.getState().priceObservations.length

    const summary = await useStore.getState().importBasketEmails([makeFile(frisco2026, 'frisco-2026.eml')])

    expect(useStore.getState().priceObservations.length).toBe(firstCount)
    expect(summary.observationsAdded).toBe(0)
    expect(summary.observationsDuplicate).toBeGreaterThan(0)
  })

  it('nieznany nadawca → filesError, 0 plików ok', async () => {
    const summary = await useStore.getState().importBasketEmails([
      makeFile('From: nobody@nowhere.pl\r\n\r\nHello', 'spam.eml'),
    ])
    expect(summary.filesOk).toBe(0)
    expect(summary.filesError).toHaveLength(1)
  })

  // ─── setItemTracked ───────────────────────────────────────────────────────

  it('setItemTracked(true) ustawia trackedManual i tracked', async () => {
    await useStore.getState().importBasketEmails([makeFile(frisco2026, 'frisco-2026.eml')])
    const item = useStore.getState().basketItems[0]

    useStore.getState().setItemTracked(item.id, true)

    const updated = useStore.getState().basketItems.find(i => i.id === item.id)!
    expect(updated.trackedManual).toBe(true)
    expect(updated.tracked).toBe(true)
  })

  it('setItemTracked(null) usuwa trackedManual, przywraca auto', async () => {
    await useStore.getState().importBasketEmails([makeFile(frisco2026, 'frisco-2026.eml')])
    const item = useStore.getState().basketItems[0]
    useStore.getState().setItemTracked(item.id, true)

    useStore.getState().setItemTracked(item.id, null)

    const updated = useStore.getState().basketItems.find(i => i.id === item.id)!
    expect(updated.trackedManual).toBeUndefined()
    // auto: tracked zależy od count vs trackingThreshold
    const count = useStore.getState().priceObservations.filter(o => o.itemId === item.id).length
    expect(updated.tracked).toBe(count >= defaultBasketConfig.trackingThreshold)
  })

  // ─── mergeBasketItems ─────────────────────────────────────────────────────

  it('merge: obserwacje z sourceId przenosi na targetId, source znika', async () => {
    await useStore.getState().importBasketEmails([makeFile(frisco2026, 'frisco-2026.eml')])
    const items = useStore.getState().basketItems
    if (items.length < 2) return

    const [target, source] = items
    const sourceObsBefore = useStore.getState().priceObservations.filter(o => o.itemId === source.id)

    useStore.getState().mergeBasketItems(target.id, source.id)

    const { basketItems, priceObservations } = useStore.getState()
    expect(basketItems.find(i => i.id === source.id)).toBeUndefined()
    const movedObs = priceObservations.filter(o => o.itemId === target.id)
    expect(movedObs.length).toBeGreaterThanOrEqual(sourceObsBefore.length)
    const merged = basketItems.find(i => i.id === target.id)!
    expect(merged.aliases).toContain(source.normalizedName)
  })

  it('merge na nieistniejących id nie zmienia stanu', async () => {
    await useStore.getState().importBasketEmails([makeFile(frisco2026, 'frisco-2026.eml')])
    const countBefore = useStore.getState().basketItems.length

    useStore.getState().mergeBasketItems('ghost-a', 'ghost-b')

    expect(useStore.getState().basketItems.length).toBe(countBefore)
  })

  // ─── removeBasketItem ─────────────────────────────────────────────────────

  it('removeBasketItem usuwa item i jego obserwacje', async () => {
    await useStore.getState().importBasketEmails([makeFile(frisco2026, 'frisco-2026.eml')])
    const item = useStore.getState().basketItems[0]

    useStore.getState().removeBasketItem(item.id)

    expect(useStore.getState().basketItems.find(i => i.id === item.id)).toBeUndefined()
    expect(useStore.getState().priceObservations.filter(o => o.itemId === item.id)).toHaveLength(0)
  })

  // ─── setBasketConfig ──────────────────────────────────────────────────────

  it('zmiana trackingThreshold rekomputuje tracked', async () => {
    // Z jednym plikiem produkty mają ~1 obserwację → domyślnie untracked (threshold=3)
    await useStore.getState().importBasketEmails([makeFile(frisco2026, 'frisco-2026.eml')])
    const before = useStore.getState().basketItems.filter(i => i.tracked).length

    // Obniż próg do 1 → wszystkie produkty z ≥1 obserwacją powinny być tracked
    useStore.getState().setBasketConfig({ trackingThreshold: 1 })
    const after = useStore.getState().basketItems.filter(i => i.tracked).length

    expect(after).toBeGreaterThan(before)
    expect(useStore.getState().basketConfig.trackingThreshold).toBe(1)
  })

  // ─── export → import round-trip ───────────────────────────────────────────

  it('exportData → importData zachowuje koszyk', async () => {
    await useStore.getState().importBasketEmails([
      makeFile(frisco2026, 'frisco-2026.eml'),
      makeFile(frisco2021, 'frisco-2021.eml'),
    ])
    const itemsBefore = useStore.getState().basketItems
    const obsBefore = useStore.getState().priceObservations

    const json = useStore.getState().exportData()
    resetBasket()
    useStore.getState().importData(json)

    const { basketItems, priceObservations, basketConfig } = useStore.getState()
    expect(basketItems).toHaveLength(itemsBefore.length)
    expect(priceObservations).toHaveLength(obsBefore.length)
    expect(basketConfig).toEqual(defaultBasketConfig)
  })

  it('exportData → importData zachowuje nakładkę GUS officialCpi', () => {
    const officialCpi = [
      { month: '2025-12', valuePct: 4.8 },
      { month: '2026-04', valuePct: 4.1 },
    ]

    useStore.getState().setBasketConfig({ officialCpi })
    const json = useStore.getState().exportData()
    resetBasket()
    useStore.getState().importData(json)

    expect(useStore.getState().basketConfig.officialCpi).toEqual(officialCpi)
  })
})

// ─── basket persistence in API mode ───────────────────────────────────────────
// W trybie API koszyk nie ma backendu, więc musi przeżyć przeładowanie przez
// localStorage (basket-only), a hydrateFromBackend nie może go wyzerować.

describe('basket persistence (API mode helpers)', () => {
  const fullPersist = JSON.stringify({
    version: 0,
    state: {
      accounts: [{ id: 'a1' }],
      transactions: [{ id: 't1' }],
      settings: { monthlyIncome: 999 },
      basketItems: [{ id: 'b1', displayName: 'X' }],
      priceObservations: [{ itemId: 'b1', date: '2025-01-01', unitPrice: 5 }],
      basketConfig: { ...defaultBasketConfig, trackingThreshold: 7 },
    },
  })

  it('basketOnlyPersistValue zostawia tylko koszyk, usuwa dane finansowe', () => {
    const out = JSON.parse(basketOnlyPersistValue(fullPersist)!)
    expect(out.version).toBe(0)
    expect(out.state.basketItems).toHaveLength(1)
    expect(out.state.priceObservations).toHaveLength(1)
    expect(out.state.basketConfig.trackingThreshold).toBe(7)
    // dane finansowe nie mogą trafić do localStorage w API mode
    expect(out.state.accounts).toBeUndefined()
    expect(out.state.transactions).toBeUndefined()
    expect(out.state.settings).toBeUndefined()
  })

  it('niepoprawny JSON → undefined (nic nie zapisujemy)', () => {
    expect(basketOnlyPersistValue('{ niepoprawny json')).toBeUndefined()
  })

  it('round-trip: basket-only zapis → readPersistedLocalState odczytuje koszyk', () => {
    localStorage.setItem('savings-planner-v1', basketOnlyPersistValue(fullPersist)!)
    const read = readPersistedLocalState()!
    expect(read.basketItems).toHaveLength(1)
    expect(read.priceObservations).toHaveLength(1)
    expect(read.basketConfig.trackingThreshold).toBe(7)
    // finanse puste po stripie — backend i tak jest źródłem prawdy
    expect(read.accounts).toEqual([])
    expect(read.transactions).toEqual([])
  })
})
