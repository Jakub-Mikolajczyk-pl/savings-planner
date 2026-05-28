import { Hero } from './components/hero/Hero'
import { GoalList } from './components/goals/GoalList'
import { LoanList } from './components/loans/LoanList'
import { MortgageSection } from './components/mortgage/MortgageSection'
import { ScheduleTable } from './components/schedule/ScheduleTable'
import { SavingsChart } from './components/chart/SavingsChart'
import { WhatIfSlider } from './components/chart/WhatIfSlider'
import { Collapsible } from './components/ui/Collapsible'
import { AdvancedSettings } from './components/ui/AdvancedSettings'
import { useStore } from './store'
import { TrendingUp } from 'lucide-react'

export default function App() {
  const goals = useStore(s => s.goals)
  const loans = useStore(s => s.loans)
  const mortgagePlan = useStore(s => s.mortgagePlan)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl">
            <TrendingUp size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Savings Planner</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Planuj oszczędności i śledź cele</p>
          </div>
        </div>

        {/* Hero: quick stats + progress cards */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <Hero />
        </div>

        {/* Savings chart + what-if */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Narastanie oszczędności</h2>
          <SavingsChart />
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Symulacja what-if</p>
            <WhatIfSlider />
          </div>
        </div>

        {/* Cele */}
        <Collapsible
          title="Cele"
          defaultOpen={goals.length === 0}
          badge={goals.length > 0 ? String(goals.length) : undefined}
        >
          <GoalList />
        </Collapsible>

        {/* Kredyty */}
        <Collapsible
          title="Kredyty / Raty"
          defaultOpen={loans.length === 0}
          badge={loans.length > 0 ? String(loans.length) : undefined}
        >
          <LoanList />
        </Collapsible>

        <Collapsible
          title="Kredyt hipoteczny"
          defaultOpen={!mortgagePlan}
          badge={mortgagePlan ? 'aktywny plan' : undefined}
        >
          <MortgageSection />
        </Collapsible>

        {/* Harmonogram */}
        <Collapsible title="Harmonogram miesięczny" badge={goals.length > 0 || mortgagePlan ? 'edytowalny' : undefined}>
          <ScheduleTable />
        </Collapsible>

        {/* Zaawansowane */}
        <Collapsible title="Zaawansowane">
          <AdvancedSettings />
        </Collapsible>

        <p className="text-center text-xs text-gray-300 dark:text-gray-700 pb-4">
          Dane zapisywane lokalnie w przeglądarce · brak serwera · brak telemetrii
        </p>
      </div>
    </div>
  )
}
