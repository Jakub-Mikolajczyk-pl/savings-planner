import { describe, it, expect } from 'vitest'
import { creditCardStatus } from './creditCard'
import type { CreditCard } from './types'

const card = (patch: Partial<CreditCard> = {}): CreditCard => ({
  name: 'Karta kredytowa',
  limit: 10000,
  availableLimit: 10000,
  ...patch,
})

describe('creditCardStatus', () => {
  it('liczy wykorzystane jako limit - dostępne', () => {
    const status = creditCardStatus(card({ availableLimit: 5800 }))
    expect(status.used).toBe(4200)
    expect(status.utilizationPct).toBe(42)
    expect(status.level).toBe('ok')
  })

  it('pusta karta = zero wykorzystania', () => {
    const status = creditCardStatus(card({ availableLimit: 10000 }))
    expect(status.used).toBe(0)
    expect(status.utilization).toBe(0)
    expect(status.level).toBe('ok')
  })

  it('próg ostrzeżenia >=70% to warn', () => {
    expect(creditCardStatus(card({ availableLimit: 3000 })).level).toBe('warn')
  })

  it('próg >=90% to high', () => {
    expect(creditCardStatus(card({ availableLimit: 500 })).level).toBe('high')
  })

  it('przycina dostępny limit powyżej limitu do [0, limit]', () => {
    const status = creditCardStatus(card({ availableLimit: 15000 }))
    expect(status.availableLimit).toBe(10000)
    expect(status.used).toBe(0)
  })

  it('przycina ujemny dostępny limit do zera (karta na maksie)', () => {
    const status = creditCardStatus(card({ availableLimit: -200 }))
    expect(status.availableLimit).toBe(0)
    expect(status.used).toBe(10000)
    expect(status.utilizationPct).toBe(100)
  })

  it('zabezpiecza przed limitem zero (brak dzielenia przez zero)', () => {
    const status = creditCardStatus(card({ limit: 0, availableLimit: 0 }))
    expect(status.utilization).toBe(0)
    expect(status.used).toBe(0)
  })
})
