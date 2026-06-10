import type { Account, Settings } from './types'

/*
 * FX: przeliczanie walut obcych na walutę bazową (PLN).
 *
 * Konta mają pole `currency`, ale do tej pory salda sumowały się 1:1.
 * Teraz każda kwota w walucie obcej jest mnożona przez kurs z ustawień
 * (ręczny override) albo z DEFAULT_FX_RATES, gdy user nic nie ustawił.
 */

export type FxSettings = Pick<Settings, 'baseCurrency' | 'fxRates'>

export const BASE_CURRENCY = 'PLN'

/** Przybliżone kursy NBP — punkt startowy, user nadpisuje w Ustawieniach. */
export const DEFAULT_FX_RATES: Record<string, number> = {
  EUR: 4.25,
  USD: 3.6,
  CHF: 4.55,
  GBP: 4.9,
}

/** Waluty pokazywane w edytorze kursów nawet bez kont w tej walucie. */
export const COMMON_CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP']

export function fxRateToBase(currency: string | undefined, fx?: FxSettings): number {
  const base = fx?.baseCurrency ?? BASE_CURRENCY
  if (!currency || currency === base) return 1
  const override = fx?.fxRates?.[currency]
  if (override !== undefined && override > 0) return override
  return DEFAULT_FX_RATES[currency] ?? 1
}

export function convertToBase(amount: number, currency: string | undefined, fx?: FxSettings): number {
  return Math.round(amount * fxRateToBase(currency, fx) * 100) / 100
}

/** Czy kwoty w tej walucie są w ogóle przeliczane (false = brak kursu, sumujemy 1:1). */
export function hasKnownRate(currency: string | undefined, fx?: FxSettings): boolean {
  const base = fx?.baseCurrency ?? BASE_CURRENCY
  if (!currency || currency === base) return true
  if ((fx?.fxRates?.[currency] ?? 0) > 0) return true
  return DEFAULT_FX_RATES[currency] !== undefined
}

/** Waluty obce do pokazania w edytorze kursów: standardowe + te użyte na kontach. */
export function currenciesForRateEditor(accounts: Account[], fx?: FxSettings): string[] {
  const base = fx?.baseCurrency ?? BASE_CURRENCY
  const used = accounts.map(account => account.currency).filter(currency => currency && currency !== base)
  return [...new Set([...COMMON_CURRENCIES, ...used])].sort()
}
