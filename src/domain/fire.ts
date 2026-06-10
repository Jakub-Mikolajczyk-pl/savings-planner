/*
 * FIRE: kiedy kapitał pozwala przestać pracować.
 *
 * Klasyczna reguła bezpiecznej wypłaty: cel = roczne wydatki / SWR
 * (np. 4% => 25× rocznych wydatków). Projekcja miesięczna z kapitalizacją,
 * pasma optymistyczne/pesymistyczne = ±2 p.p. zwrotu.
 */

export interface FireInputs {
  currentCapital: number
  monthlyContribution: number
  annualReturnPct: number // realny (po inflacji) oczekiwany zwrot
  targetMonthlySpending: number
  withdrawalRatePct: number // SWR, np. 4
}

export interface FireProjectionPoint {
  monthIndex: number
  value: number
}

export interface FireResult {
  targetAmount: number
  monthsToTarget?: number // undefined = nieosiągalne w 100 lat
  series: FireProjectionPoint[] // punkt co 12 miesięcy
}

const MAX_MONTHS = 1200 // 100 lat — dalej nie ma sensu liczyć

export function projectFire(inputs: FireInputs): FireResult {
  const targetAmount = inputs.withdrawalRatePct > 0
    ? Math.round((inputs.targetMonthlySpending * 12) / (inputs.withdrawalRatePct / 100))
    : Infinity
  const monthlyRate = inputs.annualReturnPct / 100 / 12

  let value = Math.max(0, inputs.currentCapital)
  const contribution = Math.max(0, inputs.monthlyContribution)
  const series: FireProjectionPoint[] = [{ monthIndex: 0, value: Math.round(value) }]
  let monthsToTarget: number | undefined = value >= targetAmount ? 0 : undefined

  for (let month = 1; month <= MAX_MONTHS; month++) {
    value = value * (1 + monthlyRate) + contribution
    if (monthsToTarget === undefined && value >= targetAmount) {
      monthsToTarget = month
    }
    if (month % 12 === 0) {
      series.push({ monthIndex: month, value: Math.round(value) })
    }
    // Wykres kończymy ~5 lat po osiągnięciu celu, żeby nie rysować 100 lat.
    if (monthsToTarget !== undefined && month >= monthsToTarget + 60 && month % 12 === 0) break
  }

  return {
    targetAmount: Number.isFinite(targetAmount) ? targetAmount : 0,
    monthsToTarget,
    series,
  }
}

export interface FireBands {
  base: FireResult
  optimistic: FireResult // +2 p.p.
  pessimistic: FireResult // -2 p.p. (nie mniej niż 0%)
}

export function fireBands(inputs: FireInputs): FireBands {
  return {
    base: projectFire(inputs),
    optimistic: projectFire({ ...inputs, annualReturnPct: inputs.annualReturnPct + 2 }),
    pessimistic: projectFire({ ...inputs, annualReturnPct: Math.max(0, inputs.annualReturnPct - 2) }),
  }
}
