import { describe, it, expect } from 'vitest'
import { effectiveMonthlyAmount } from './subscription'

describe('effectiveMonthlyAmount', () => {
  it('zwraca kwotę bez zmian dla miesięcznego, niedzielonego', () => {
    expect(effectiveMonthlyAmount(50, 'monthly', 1)).toBe(50)
  })

  it('rozkłada roczny na 12 miesięcy', () => {
    expect(effectiveMonthlyAmount(120, 'yearly', 1)).toBe(10)
  })

  it('dzieli koszt rodzinny przez liczbę osób', () => {
    expect(effectiveMonthlyAmount(60, 'monthly', 3)).toBe(20)
  })

  it('łączy roczny + podział (np. rodzinny Spotify za rok)', () => {
    expect(effectiveMonthlyAmount(240, 'yearly', 4)).toBe(5)
  })

  it('domyślnie traktuje brak okresu jako miesięczny i bez podziału', () => {
    expect(effectiveMonthlyAmount(30)).toBe(30)
  })

  it('zabezpiecza przed dzieleniem przez zero', () => {
    expect(effectiveMonthlyAmount(30, 'monthly', 0)).toBe(30)
  })
})
