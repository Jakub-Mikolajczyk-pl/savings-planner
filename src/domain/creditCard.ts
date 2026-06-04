import type { CreditCard } from './types'

export type CreditCardLevel = 'ok' | 'warn' | 'high'

export interface CreditCardStatus {
  limit: number
  availableLimit: number
  used: number            // wykorzystane = limit - dostępne; to zejdzie przy spłacie
  utilization: number     // 0..1
  utilizationPct: number  // 0..100 (zaokrąglone)
  level: CreditCardLevel  // próg ostrzeżenia: >=70% warn, >=90% high
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/*
 * Status karty liczymy defensywnie:
 * - limit nie może być ujemny,
 * - dostępny limit przycinamy do [0, limit] (user mógł wpisać brzydką wartość),
 * - wykorzystane = limit - dostępne (dla transactora = przyszła spłata).
 *
 * Świadomie NIE wpinamy tego w bazowy harmonogram celów: spłata karty może siedzieć
 * już w baseline wydatków jako proxy. Osobna prognoza najbliższego cyklu pokazuje ją
 * jako widoczną kwotę do zapłaty.
 */
export function creditCardStatus(card: CreditCard): CreditCardStatus {
  const limit = Math.max(0, card.limit || 0)
  const availableLimit = clamp(card.availableLimit || 0, 0, limit)
  const used = limit - availableLimit
  const utilization = limit > 0 ? used / limit : 0
  const utilizationPct = Math.round(utilization * 100)
  const level: CreditCardLevel = utilization >= 0.9 ? 'high' : utilization >= 0.7 ? 'warn' : 'ok'
  return { limit, availableLimit, used, utilization, utilizationPct, level }
}
