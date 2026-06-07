// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseOrderEmail } from './parseOrderEmail'
import { normalizeName } from './nameNormalize'
import frisco2026 from './__fixtures__/frisco-2026.eml?raw'
import frisco2021 from './__fixtures__/frisco-2021.eml?raw'
import lisek2025 from './__fixtures__/lisek-2025.eml?raw'
import lisek2022 from './__fixtures__/lisek-2022.eml?raw'

const fixtures: Record<string, string> = {
  'frisco-2026.eml': frisco2026,
  'frisco-2021.eml': frisco2021,
  'lisek-2025.eml': lisek2025,
  'lisek-2022.eml': lisek2022,
}

function fixture(name: string): string {
  return fixtures[name]
}

// ─── Frisco 2026 ─────────────────────────────────────────────────────────────

describe('Frisco 2026 (bez VAT)', () => {
  const result = parseOrderEmail(fixture('frisco-2026.eml'))

  it('parsuje pomyślnie', () => {
    expect(result.ok).toBe(true)
  })

  it('wykrywa sklep frisco', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.store).toBe('frisco')
  })

  it('poprawny orderRef', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.orderRef).toBe('FRISCO-2026-FIX')
  })

  it('poprawna data', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.date).toBe('2026-06-01')
  })

  it('parsuje ≥37 pozycji (bez zerowych)', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.lines.length).toBeGreaterThanOrEqual(37)
  })

  it('flaga wagi: Marchew luz', () => {
    if (!result.ok) throw new Error(result.reason)
    const marchew = result.lines.find(l => l.rawName.includes('Marchew luz'))
    expect(marchew).toBeDefined()
    expect(marchew!.isWeightItem).toBe(true)
  })

  it('flaga wagi: Cebula', () => {
    if (!result.ok) throw new Error(result.reason)
    const cebula = result.lines.find(l => l.rawName.includes('Cebula 6-12'))
    expect(cebula).toBeDefined()
    expect(cebula!.isWeightItem).toBe(true)
  })

  it('produkty bez wagi: prawidłowa flaga false', () => {
    if (!result.ok) throw new Error(result.reason)
    const serek = result.lines.find(l => l.rawName.includes('Serek wiejski'))
    expect(serek).toBeDefined()
    expect(serek!.isWeightItem).toBe(false)
  })

  it('PIĄTNICA Serek wiejski: unitPrice 3,82, qty 4', () => {
    if (!result.ok) throw new Error(result.reason)
    const serek = result.lines.find(l => l.rawName.includes('Serek wiejski'))
    expect(serek).toBeDefined()
    expect(serek!.unitPrice).toBe(3.82)
    expect(serek!.quantity).toBe(4)
  })

  it('pomija pozycje 0,00 zł (gratisy)', () => {
    if (!result.ok) throw new Error(result.reason)
    const zeroPriced = result.lines.filter(l => l.unitPrice === 0)
    expect(zeroPriced).toHaveLength(0)
  })
})

// ─── Frisco 2021 ─────────────────────────────────────────────────────────────

describe('Frisco 2021 (z kolumną VAT)', () => {
  const result = parseOrderEmail(fixture('frisco-2021.eml'))

  it('parsuje pomyślnie', () => {
    expect(result.ok).toBe(true)
  })

  it('poprawny orderRef', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.orderRef).toBe('FRISCO-2021-FIX')
  })

  it('poprawna data', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.date).toBe('2021-03-29')
  })

  it('DAWTONA: unitPrice = 2,12 (nie suma 4,24)', () => {
    if (!result.ok) throw new Error(result.reason)
    const daw = result.lines.find(l => l.rawName.includes('DAWTONA'))
    expect(daw).toBeDefined()
    expect(daw!.unitPrice).toBe(2.12)
    expect(daw!.quantity).toBe(2)
    expect(daw!.lineTotal).toBe(4.24)
  })

  it('PIĄTNICA Serek wiejski 2021: unitPrice = 2,54 (nie 5% VAT)', () => {
    if (!result.ok) throw new Error(result.reason)
    const serek = result.lines.find(l => l.rawName.includes('Serek wiejski'))
    expect(serek).toBeDefined()
    expect(serek!.unitPrice).toBe(2.54)
  })

  it('brak pozycji 0,00 zł', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.lines.filter(l => l.unitPrice === 0)).toHaveLength(0)
  })
})

// ─── Lisek 2025 ──────────────────────────────────────────────────────────────

describe('Lisek 2025 (szablon data-type=code)', () => {
  const result = parseOrderEmail(fixture('lisek-2025.eml'))

  it('parsuje pomyślnie', () => {
    expect(result.ok).toBe(true)
  })

  it('wykrywa sklep lisek', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.store).toBe('lisek')
  })

  it('poprawny orderRef', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.orderRef).toBe('LISEK-2025-FIX')
  })

  it('poprawna data', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.date).toBe('2025-10-05')
  })

  it('Fanta Exotic 330ml: unitPrice=4,99 (=9,98/2)', () => {
    if (!result.ok) throw new Error(result.reason)
    const fanta = result.lines.find(l => l.rawName.includes('Fanta Exotic'))
    expect(fanta).toBeDefined()
    expect(fanta!.quantity).toBe(2)
    expect(fanta!.lineTotal).toBe(9.98)
    expect(fanta!.unitPrice).toBe(4.99)
  })

  it('isWeightItem jest false dla wszystkich linii Lisek', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.lines.every(l => l.isWeightItem === false)).toBe(true)
  })
})

// ─── Lisek 2022 ──────────────────────────────────────────────────────────────

describe('Lisek 2022 (szablon N x)', () => {
  const result = parseOrderEmail(fixture('lisek-2022.eml'))

  it('parsuje pomyślnie', () => {
    expect(result.ok).toBe(true)
  })

  it('poprawny orderRef', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.orderRef).toBe('LISEK-2022-FIX')
  })

  it('poprawna data (polski miesiąc "Grudnia")', () => {
    if (!result.ok) throw new Error(result.reason)
    expect(result.date).toBe('2022-12-22')
  })

  it('Natura sok 4x: unitPrice=8,99 (=35,96/4)', () => {
    if (!result.ok) throw new Error(result.reason)
    const nat = result.lines.find(l => l.rawName.includes('Natura'))
    expect(nat).toBeDefined()
    expect(nat!.quantity).toBe(4)
    expect(nat!.lineTotal).toBe(35.96)
    expect(nat!.unitPrice).toBe(8.99)
  })
})

// ─── nameNormalize ────────────────────────────────────────────────────────────

describe('nameNormalize', () => {
  it('wyciąga rozmiar z końca nazwy', () => {
    const r = normalizeName('PIĄTNICA Serek wiejski bez laktozy 200g')
    expect(r.packageSize).toBe(200)
    expect(r.unit).toBe('g')
  })

  it('bierze OSTATNI token rozmiaru z "(400g-600g) 500g"', () => {
    const r = normalizeName('FRISCO FRESH Filet z piersi z kurczaka (400g-600g) 500g')
    expect(r.packageSize).toBe(500)
    expect(r.unit).toBe('g')
  })

  it('normalizedName identyczny dla serka z 2021 i 2026', () => {
    const r2021 = normalizeName('PIĄTNICA Serek wiejski bez laktozy 200g')
    const r2026 = normalizeName('PIĄTNICA Serek wiejski bez laktozy 200g')
    expect(r2021.normalizedName).toBe(r2026.normalizedName)
    expect(r2021.normalizedName).toBe('piątnica serek wiejski bez laktozy')
  })

  it('extrahuje brand z wielkich liter', () => {
    const r = normalizeName('SOKOŁÓW Mięso mielone wołowe 400g')
    expect(r.brand).toBe('SOKOŁÓW')
  })

  it('multi-token brand: FRISCO FRESH', () => {
    const r = normalizeName('FRISCO FRESH Marchew luz 750g')
    expect(r.brand).toBe('FRISCO FRESH')
  })

  it('multi-token brand: SANTE GO ON!', () => {
    const r = normalizeName('SANTE GO ON! Granola proteinowa z brownie i wiśniami 300g')
    expect(r.brand).toBe('SANTE GO ON!')
  })

  it('brak brand gdy nazwa zaczyna się małą literą (Lisek)', () => {
    const r = normalizeName('Kinder Chocolate batoniki 100g')
    expect(r.brand).toBeUndefined()
  })

  it('jednostka ml', () => {
    const r = normalizeName('MAKŁOWICZ I SYNOWIE Lody wanilia z palonym masłem 460ml')
    expect(r.packageSize).toBe(460)
    expect(r.unit).toBe('ml')
  })

  it('jednostka l z przecinkiem: 1,5l', () => {
    const r = normalizeName('COCA-COLA ZERO Napój gazowany 1,5l')
    expect(r.packageSize).toBe(1.5)
    expect(r.unit).toBe('l')
  })

  it('brak rozmiaru → szt, packageSize undefined', () => {
    const r = normalizeName('Jabłka')
    expect(r.unit).toBe('szt')
    expect(r.packageSize).toBeUndefined()
  })

  it('displayName = trimowany rawName', () => {
    const r = normalizeName('  PIĄTNICA Serek wiejski bez laktozy 200g  ')
    expect(r.displayName).toBe('PIĄTNICA Serek wiejski bez laktozy 200g')
  })
})
