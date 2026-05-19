import { useMemo } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Legend, ResponsiveContainer,
} from 'recharts'
import { useStore } from '../../store'
import { buildSchedule } from '../../domain/allocation'
import { formatPLN, formatYearMonth } from '../../domain/formatting'

const LOAN_COLORS = ['#f97316', '#8b5cf6', '#ec4899', '#14b8a6']

export function LoanChart() {
  const settings = useStore(s => s.settings)
  const goals = useStore(s => s.goals)
  const loans = useStore(s => s.loans)
  const overrides = useStore(s => s.overrides)
  const loanOverpayment = useStore(s => s.loanOverpayment)
  const setLoanOverpayment = useStore(s => s.setLoanOverpayment)

  const schedule = useMemo(
    () => buildSchedule(settings, goals, loans, overrides),
    [settings, goals, loans, overrides],
  )
  const whatIfSchedule = useMemo(
    () => buildSchedule(settings, goals, loans, overrides, 0, loanOverpayment),
    [settings, goals, loans, overrides, loanOverpayment],
  )

  if (loans.length === 0) return null

  // Build chart data: one point per month, one key per loan
  interface ChartPoint { label: string; [k: string]: string | number }
  const data: ChartPoint[] = schedule.rows.map((row, i) => {
    const point: ChartPoint = { label: row.label }
    loans.forEach(loan => {
      const e = row.loanEntries.find(e => e.loanId === loan.id)
      point[`base_${loan.id}`] = e?.balanceAfter ?? 0
      const wie = whatIfSchedule.rows[i]?.loanEntries.find(e => e.loanId === loan.id)
      point[`wi_${loan.id}`] = wie?.balanceAfter ?? 0
    })
    return point
  })

  const tickInterval = Math.max(1, Math.floor(data.length / 12))

  // What-if payoff delta summary
  const payoffSummary = loans.map((loan, i) => {
    const base = schedule.loanProgress.find(lp => lp.loanId === loan.id)
    const wi = whatIfSchedule.loanProgress.find(lp => lp.loanId === loan.id)
    const baseYM = base?.payoffMonth ?? base?.projectedPayoffMonth
    const wiYM = wi?.payoffMonth ?? wi?.projectedPayoffMonth
    if (!baseYM || !wiYM || baseYM === wiYM) return null
    const [by, bm] = baseYM.split('-').map(Number)
    const [wy, wm] = wiYM.split('-').map(Number)
    const delta = (by - wy) * 12 + (bm - wm)
    if (delta <= 0) return null
    return { name: loan.name, color: LOAN_COLORS[i % LOAN_COLORS.length], delta }
  }).filter(Boolean)

  return (
    <div className="space-y-4">
      {/* Nadpłata slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Co jeśli nadpłacam kredyt o:</span>
          <span className={`font-bold tabular-nums ${loanOverpayment > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
            {loanOverpayment === 0 ? 'bez nadpłaty' : `+${formatPLN(loanOverpayment)}/mies.`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={10000}
          step={100}
          value={loanOverpayment}
          onChange={e => setLoanOverpayment(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>0 zł</span>
          <button onClick={() => setLoanOverpayment(0)} className="text-orange-500 hover:text-orange-700 underline">reset</button>
          <span>+10 000 zł</span>
        </div>
      </div>

      {/* Payoff summary */}
      {payoffSummary.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <span className="text-xs text-gray-500 dark:text-gray-400 self-center">Efekt nadpłaty:</span>
          {payoffSummary.map(s => s && (
            <span key={s.name} className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
              <span style={{ color: s.color }}>■</span>{' '}
              {s.name}: −{s.delta} mies.
            </span>
          ))}
        </div>
      )}

      {/* Loan balance chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickInterval - 1} className="fill-gray-500" />
          <YAxis
            tickFormatter={v => `${Math.round(v / 1000)}k`}
            tick={{ fontSize: 11 }}
            width={40}
            className="fill-gray-500"
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const isWhatIf = name.startsWith('wi_')
              const loanId = name.replace(/^(base_|wi_)/, '')
              const loan = loans.find(l => l.id === loanId)
              return [formatPLN(value), `${loan?.name ?? loanId}${isWhatIf ? ' (nadpłata)' : ''}`]
            }}
            contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
          <Legend
            formatter={(value: string) => {
              const isWhatIf = value.startsWith('wi_')
              const loanId = value.replace(/^(base_|wi_)/, '')
              const loan = loans.find(l => l.id === loanId)
              return `${loan?.name ?? loanId}${isWhatIf ? ' (nadpłata)' : ''}`
            }}
            wrapperStyle={{ fontSize: 11 }}
          />

          {/* Payoff reference lines */}
          {schedule.loanProgress.map((lp, i) => {
            const payoffYM = lp.payoffMonth
            if (!payoffYM) return null
            const color = LOAN_COLORS[i % LOAN_COLORS.length]
            return (
              <ReferenceLine
                key={`payoff-${lp.loanId}`}
                x={formatYearMonth(payoffYM)}
                stroke={color}
                strokeDasharray="4 2"
                label={{ value: `Spłata: ${lp.name}`, fontSize: 9, fill: color, position: 'insideTopLeft' }}
              />
            )
          })}

          {/* Base balance lines */}
          {loans.map((loan, i) => (
            <Line
              key={`base_${loan.id}`}
              type="monotone"
              dataKey={`base_${loan.id}`}
              name={`base_${loan.id}`}
              stroke={LOAN_COLORS[i % LOAN_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}

          {/* What-if (overpayment) dashed lines */}
          {loanOverpayment > 0 && loans.map((loan, i) => (
            <Line
              key={`wi_${loan.id}`}
              type="monotone"
              dataKey={`wi_${loan.id}`}
              name={`wi_${loan.id}`}
              stroke={LOAN_COLORS[i % LOAN_COLORS.length]}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeOpacity={0.6}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400">
        Przerywana linia = scenariusz z nadpłatą. Pionowa linia = data spłaty. Po spłacie rata wraca do puli oszczędności.
      </p>
    </div>
  )
}
