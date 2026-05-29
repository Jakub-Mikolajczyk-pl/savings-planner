import { useEffect } from 'react'
import { Hero } from './components/hero/Hero'
import { AccountsSection } from './components/accounts/AccountsSection'
import { GoalList } from './components/goals/GoalList'
import { LoanList } from './components/loans/LoanList'
import { SubscriptionList } from './components/subscriptions/SubscriptionList'
import { UpcomingExpenseList } from './components/expenses/UpcomingExpenseList'
import { MortgageSection } from './components/mortgage/MortgageSection'
import { ScheduleTable } from './components/schedule/ScheduleTable'
import { SavingsChart } from './components/chart/SavingsChart'
import { WhatIfSlider } from './components/chart/WhatIfSlider'
import { Collapsible } from './components/ui/Collapsible'
import { AdvancedSettings } from './components/ui/AdvancedSettings'
import { useStore } from './store'
import { formatPLN } from './domain/formatting'
import { BACKEND_MODE, IS_API_MODE } from './config'
import { TrendingUp } from 'lucide-react'

export default function App() {
  /*
   * Komponent funkcyjny Reacta to zwykła funkcja zwracająca JSX.
   *
   * Angular porównanie:
   * - Angular Component = klasa + template HTML + metadata dekoratora.
   * - React Component = funkcja; "template" siedzi bezpośrednio w JSX.
   *
   * useStore(selector) subskrybuje tylko wycinek Zustand store.
   * Gdy zmieni się np. loans, komponent odświeży się dlatego, że używa loans.
   */
  const hydrateFromBackend = useStore(s => s.hydrateFromBackend)
  const isHydrating = useStore(s => s.isHydrating)
  const hasHydratedFromBackend = useStore(s => s.hasHydratedFromBackend)
  const syncError = useStore(s => s.syncError)
  const goals = useStore(s => s.goals)
  const loans = useStore(s => s.loans)
  const accounts = useStore(s => s.accounts)
  const mortgagePlan = useStore(s => s.mortgagePlan)
  const subscriptions = useStore(s => s.subscriptions)
  const upcomingExpenses = useStore(s => s.upcomingExpenses)
  const activeSubscriptionsTotal = subscriptions
    .filter(subscription => subscription.active)
    .reduce((sum, subscription) => sum + subscription.monthlyAmount, 0)
  const pendingExpensesTotal = upcomingExpenses
    .filter(expense => !expense.isPaid)
    .reduce((sum, expense) => sum + expense.amount, 0)

  useEffect(() => {
    /*
     * useEffect odpala side effect po renderze.
     * Tutaj side effectem jest request do backendu.
     *
     * Angular porównanie:
     * Najbliżej temu do ngOnInit(), ale mentalny model jest inny:
     * useEffect zależy od tablicy dependencies i może odpalić się ponownie,
     * gdy któraś zależność zmieni referencję/wartość.
     */
    if (IS_API_MODE && !hasHydratedFromBackend && !isHydrating) {
      void hydrateFromBackend()
    }
  }, [hasHydratedFromBackend, hydrateFromBackend, isHydrating])

  return (
    /*
     * className zamiast class:
     * JSX jest bliżej JS niż HTML. `class` jest słowem zarezerwowanym JS,
     * więc React używa `className`.
     *
     * Fragmentów ngIf/ngFor tutaj nie ma. Warunkowe renderowanie robimy
     * zwykłym JavaScriptem: condition && <Element /> albo ternary.
     */
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {IS_API_MODE && isHydrating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/80 dark:bg-gray-950/80">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 shadow-lg">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Ładuję dane z backendu...</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Zustand działa teraz jako cache aplikacji.</p>
          </div>
        </div>
      )}

      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

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

        {/* Stany kont */}
        <Collapsible
          title="Stany kont"
          /*
           * Props w React:
           * To odpowiednik @Input() w Angularze, ale przekazywany bez dekoratorów.
           * defaultOpen i badge trafiają do funkcji Collapsible jako argument props.
           */
          defaultOpen={accounts.length === 0}
          badge={accounts.length > 0 ? String(accounts.length) : undefined}
        >
          {/*
            children:
            Wszystko między <Collapsible>...</Collapsible> trafia do props.children.
            Angular porównanie: podobna rola do content projection <ng-content>.
          */}
          <AccountsSection />
        </Collapsible>

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
          title="Abonamenty"
          defaultOpen={subscriptions.length === 0}
          badge={activeSubscriptionsTotal > 0 ? `${formatPLN(activeSubscriptionsTotal)}/mc` : undefined}
        >
          <SubscriptionList />
        </Collapsible>

        <Collapsible
          title="Nadchodzące wydatki"
          defaultOpen={upcomingExpenses.length === 0}
          badge={pendingExpensesTotal > 0 ? formatPLN(pendingExpensesTotal) : undefined}
        >
          <UpcomingExpenseList />
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
          {BACKEND_MODE === 'api'
            ? `Dane synchronizowane z backendem przez /api${syncError ? ' · wymaga uwagi' : ''}`
            : 'Dane zapisywane lokalnie w przeglądarce · brak serwera · brak telemetrii'}
        </p>
      </div>
    </div>
  )
}
