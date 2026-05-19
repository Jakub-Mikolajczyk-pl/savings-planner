const plnFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export const formatPLN = (amount: number): string => plnFormatter.format(amount)

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
]

export const formatYearMonth = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-').map(Number)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export const addMonths = (yearMonth: string, n: number): string => {
  const [year, month] = yearMonth.split('-').map(Number)
  const date = new Date(year, month - 1 + n, 1)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export const monthDiff = (from: string, to: string): number => {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

export const currentYearMonth = (): string => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export const dateToYearMonth = (isoDate: string): string => isoDate.slice(0, 7)
