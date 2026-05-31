import type { PayPeriod } from './types'

export function periodKey(period: Pick<PayPeriod, 'accountId' | 'periodNo'>) {
  return `${period.accountId}:${period.periodNo}`
}

