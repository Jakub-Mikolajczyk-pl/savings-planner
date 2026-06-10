/*
 * Podatek Belki — 19% podatek od zysków kapitałowych.
 *
 * Wspólny silnik projekcji dla estymatora "konto maklerskie vs IKE/IKZE"
 * oraz dla kart korzyści podatkowych w planerach emerytalnych.
 */

export const BELKA_TAX_RATE = 0.19

export interface GrowthProjection {
  contributed: number // suma wpłat
  finalValue: number // wartość przed podatkiem
  gains: number // zysk brutto
  taxPaid: number // podatek od zysków przy wypłacie
  netValue: number // wartość po podatku
}

/**
 * Projekcja regularnego inwestowania `monthly` zł/mc przez `years` lat
 * przy zwrocie `annualReturnPct`% rocznie (kapitalizacja miesięczna).
 * `taxRate` = podatek od zysków pobierany przy wypłacie (0 dla IKE/IKZE, 0.19 dla maklerskiego).
 */
export function projectMonthlyInvestment(
  monthly: number,
  years: number,
  annualReturnPct: number,
  taxRate: number,
): GrowthProjection {
  const months = Math.max(0, Math.round(years * 12))
  const safeMonthly = Math.max(0, monthly)
  const monthlyRate = annualReturnPct / 100 / 12

  const finalValue = monthlyRate === 0
    ? safeMonthly * months
    : safeMonthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)

  const contributed = safeMonthly * months
  const gains = Math.max(0, finalValue - contributed)
  const taxPaid = round2(gains * Math.max(0, taxRate))

  return {
    contributed: round2(contributed),
    finalValue: round2(finalValue),
    gains: round2(gains),
    taxPaid,
    netValue: round2(finalValue - taxPaid),
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100
