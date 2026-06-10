import { useMemo } from 'react'
import { FlaskConical, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import { createId } from '../../domain/id'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import { buildBaselineSchedule, compareScenario, type ScenarioInputs } from '../../domain/scenarios'
import type { PlanScenario } from '../../domain/types'

function DeltaInput({ label, value, min, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <div className="relative">
        <input
          type="number"
          step={100}
          min={min}
          value={value}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="w-full rounded-md border border-gray-200 bg-white py-2 pl-3 pr-8 text-right text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">zł</span>
      </div>
    </label>
  )
}

/*
 * Zapisane scenariusze what-if: "utrata pracy", "dziecko", "podwyżka" —
 * każdy liczony pełnym silnikiem planu i porównany z bazą.
 */
export function ScenarioManager() {
  const settings = useStore(s => s.settings)
  const goals = useStore(s => s.goals)
  const loans = useStore(s => s.loans)
  const overrides = useStore(s => s.overrides)
  const mortgagePlan = useStore(s => s.mortgagePlan)
  const subscriptions = useStore(s => s.subscriptions)
  const upcomingExpenses = useStore(s => s.upcomingExpenses)
  const updateSettings = useStore(s => s.updateSettings)

  const scenarios = useMemo(() => settings.scenarios ?? [], [settings.scenarios])

  const inputs: ScenarioInputs = useMemo(
    () => ({ settings, goals, loans, overrides, mortgagePlan, subscriptions, upcomingExpenses }),
    [settings, goals, loans, overrides, mortgagePlan, subscriptions, upcomingExpenses],
  )
  const baseline = useMemo(() => buildBaselineSchedule(inputs), [inputs])
  const impacts = useMemo(
    () => scenarios.map(scenario => compareScenario(scenario, inputs, baseline)),
    [scenarios, inputs, baseline],
  )

  const saveScenarios = (next: PlanScenario[]) => updateSettings({ scenarios: next })

  const addScenario = () => {
    saveScenarios([
      ...scenarios,
      { id: createId(), name: `Scenariusz ${scenarios.length + 1}`, incomeDelta: 0, expensesDelta: 0, loanOverpayment: 0 },
    ])
  }

  const updateScenario = (id: string, patch: Partial<PlanScenario>) => {
    saveScenarios(scenarios.map(scenario => scenario.id === id ? { ...scenario, ...patch } : scenario))
  }

  const removeScenario = (id: string) => {
    saveScenarios(scenarios.filter(scenario => scenario.id !== id))
  }

  return (
    <div className="space-y-4">
      {scenarios.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Zapisz scenariusze typu „utrata pracy −6000 zł”, „dziecko +1500 zł kosztów”
          albo „podwyżka +2000 zł” i porównuj je z planem bazowym bez ruszania danych.
        </p>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {impacts.map(impact => {
          const scenario = impact.scenario
          const freeCashDelta = impact.freeCashScenario - impact.freeCashBaseline
          const shifts = [...impact.goalShifts, ...impact.debtShifts.map(shift => ({
            goalId: shift.loanId,
            name: `Spłata: ${shift.name}`,
            baselineEta: shift.baselineEta,
            scenarioEta: shift.scenarioEta,
            monthsDelta: shift.monthsDelta,
          }))].filter(shift => shift.baselineEta || shift.scenarioEta).slice(0, 4)

          return (
            <div key={scenario.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={scenario.name}
                  onChange={e => updateScenario(scenario.id, { name: e.target.value })}
                  className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-gray-900 hover:border-gray-200 focus:border-gray-300 focus:outline-none dark:text-gray-100 dark:hover:border-gray-700"
                />
                <button
                  type="button"
                  onClick={() => removeScenario(scenario.id)}
                  className="shrink-0 rounded p-1.5 text-gray-300 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
                  aria-label={`Usuń scenariusz ${scenario.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DeltaInput
                  label="Δ dochodu / mc"
                  value={scenario.incomeDelta}
                  onChange={incomeDelta => updateScenario(scenario.id, { incomeDelta })}
                />
                <DeltaInput
                  label="Δ kosztów / mc"
                  value={scenario.expensesDelta}
                  onChange={expensesDelta => updateScenario(scenario.id, { expensesDelta })}
                />
                <DeltaInput
                  label="Nadpłata kredytów / mc"
                  value={scenario.loanOverpayment}
                  min={0}
                  onChange={loanOverpayment => updateScenario(scenario.id, { loanOverpayment: Math.max(0, loanOverpayment) })}
                />
              </div>

              <div className="mt-3 rounded-md border border-gray-100 px-3 py-2 text-sm dark:border-gray-800">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Wolne środki / mc</span>
                  <span className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                    {formatPLN(impact.freeCashScenario)}
                    <span className={`ml-1.5 text-xs ${freeCashDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      ({freeCashDelta >= 0 ? '+' : ''}{formatPLN(freeCashDelta)})
                    </span>
                  </span>
                </div>
                {shifts.map(shift => (
                  <div key={shift.goalId} className="mt-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-xs text-gray-500 dark:text-gray-400">{shift.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-gray-700 dark:text-gray-300">
                      {shift.scenarioEta ? formatYearMonth(shift.scenarioEta) : 'poza horyzontem'}
                      {shift.monthsDelta !== undefined && shift.monthsDelta !== 0 && (
                        <span className={`ml-1.5 font-medium ${shift.monthsDelta < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {shift.monthsDelta < 0 ? '' : '+'}{shift.monthsDelta} mies.
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={addScenario}
        className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Plus size={14} />
        Dodaj scenariusz
      </button>

      <p className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500">
        <FlaskConical size={13} className="mt-0.5 shrink-0" />
        Scenariusze niczego nie zmieniają w planie bazowym — to bezpieczna piaskownica
        zapisywana w ustawieniach.
      </p>
    </div>
  )
}
