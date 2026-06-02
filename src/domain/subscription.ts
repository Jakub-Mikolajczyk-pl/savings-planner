import type { BillingPeriod } from './types'

/**
 * Efektywny koszt MIESIĘCZNY abonamentu dla usera.
 *
 * Roczny abonament rozkładamy na 12 miesięcy. Abonament rodzinny dzielimy przez
 * liczbę osób, które się składają (z userem). Wynik to pojedyncza liczba, którą
 * dalej konsumuje silnik cashflow — reszta aplikacji nie musi wiedzieć o okresie
 * ani podziale.
 */
export function effectiveMonthlyAmount(
  billingAmount: number,
  billingPeriod: BillingPeriod = 'monthly',
  shareCount = 1,
): number {
  const perMonth = billingPeriod === 'yearly' ? billingAmount / 12 : billingAmount
  const divisor = shareCount > 0 ? shareCount : 1
  return perMonth / divisor
}
