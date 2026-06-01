import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarClock,
  CircleDollarSign,
  Database,
  FileUp,
  Home,
  LayoutDashboard,
  ListChecks,
  ReceiptText,
  Settings,
  ShieldCheck,
  Tags,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { AccountsSection } from './components/accounts/AccountsSection'
import { AssetsPie } from './components/accounts/AssetsPie'
import { NetWorthChart } from './components/accounts/NetWorthChart'
import { SavingsChart } from './components/chart/SavingsChart'
import { CategorizationSection } from './components/categorization/CategorizationSection'
import { WhatIfSlider } from './components/chart/WhatIfSlider'
import { UpcomingExpenseList } from './components/expenses/UpcomingExpenseList'
import { GoalInsightsSection } from './components/goals/GoalInsightsSection'
import { GoalList } from './components/goals/GoalList'
import { Hero } from './components/hero/Hero'
import { IngestSection } from './components/ingest/IngestSection'
import { LeakAnalysisSection } from './components/leakanalysis/LeakAnalysisSection'
import { LoanList } from './components/loans/LoanList'
import { MortgageSection } from './components/mortgage/MortgageSection'
import { PayPeriodsSection } from './components/payperiods/PayPeriodsSection'
import { ScheduleTable } from './components/schedule/ScheduleTable'
import { SubscriptionList } from './components/subscriptions/SubscriptionList'
import { AdvancedSettings } from './components/ui/AdvancedSettings'
import { PageHeader, SectionCard, StatCard, surface } from './components/ui/Layout'
import { allSnapshotMonths, balanceAsOf, BUCKET_LABELS, totalAssetsAsOf } from './domain/accounts'
import { buildSchedule } from './domain/allocation'
import { formatPLN, formatYearMonth } from './domain/formatting'
import { periodKey } from './domain/payPeriods'
import type { Account, AccountBucket, AccountSnapshot } from './domain/types'
import { BACKEND_MODE, IS_API_MODE } from './config'
import { useStore } from './store'

type AppTab = 'overview' | 'assets' | 'plan' | 'transactions' | 'settings'
type AppIcon = typeof LayoutDashboard

const TABS: Array<{ id: AppTab; label: string; icon: AppIcon }> = [
  { id: 'overview', label: 'Przegląd', icon: LayoutDashboard },
  { id: 'assets', label: 'Majątek', icon: WalletCards },
  { id: 'plan', label: 'Plan', icon: BarChart3 },
  { id: 'transactions', label: 'Transakcje', icon: Tags },
  { id: 'settings', label: 'Ustawienia', icon: Settings },
]

const TAB_HASH: Record<AppTab, string> = {
  overview: '#/przeglad',
  assets: '#/majatek',
  plan: '#/plan',
  transactions: '#/transakcje',
  settings: '#/ustawienia',
}

const HASH_TAB: Record<string, AppTab> = {
  '#/przeglad': 'overview',
  '#/': 'overview',
  '#/majatek': 'assets',
  '#/plan': 'plan',
  '#/transakcje': 'transactions',
  '#/ustawienia': 'settings',
}

function tabFromHash() {
  if (typeof window === 'undefined') return 'overview'
  return HASH_TAB[window.location.hash] ?? 'overview'
}

function tabNeedsAccountSnapshots(tab: AppTab) {
  return tab === 'overview' || tab === 'assets'
}

export default function App() {
  const hydrateFromBackend = useStore(s => s.hydrateFromBackend)
  const isHydrating = useStore(s => s.isHydrating)
  const hasHydratedFromBackend = useStore(s => s.hasHydratedFromBackend)
  const syncError = useStore(s => s.syncError)
  const lastSyncedAt = useStore(s => s.lastSyncedAt)
  const [activeTab, setActiveTab] = useState<AppTab>(tabFromHash)

  useEffect(() => {
    if (IS_API_MODE && !hasHydratedFromBackend && !isHydrating) {
      void hydrateFromBackend({ includeAccountSnapshots: tabNeedsAccountSnapshots(activeTab) })
    }
  }, [activeTab, hasHydratedFromBackend, hydrateFromBackend, isHydrating])

  useEffect(() => {
    const handleHashChange = () => setActiveTab(tabFromHash())
    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('popstate', handleHashChange)
    if (!window.location.hash) window.history.replaceState(null, '', TAB_HASH.overview)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('popstate', handleHashChange)
    }
  }, [])

  const navigate = (tab: AppTab) => {
    window.history.pushState(null, '', TAB_HASH[tab])
    setActiveTab(tab)
  }

  const syncLabel = IS_API_MODE
    ? syncError
      ? 'Sync wymaga uwagi'
      : lastSyncedAt
        ? `Sync ${new Date(lastSyncedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
        : isHydrating
          ? 'Ładowanie danych'
          : 'Tryb API'
    : 'Tryb lokalny'

  return (
    <div className="min-h-screen bg-[#f6f6f4] text-gray-950 dark:bg-[#101113] dark:text-gray-50">
      {IS_API_MODE && isHydrating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/80 dark:bg-gray-950/80">
          <div className="rounded-md border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Ładuję dane z backendu...</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Zustand działa teraz jako cache aplikacji.</p>
          </div>
        </div>
      )}

      <div className="lg:flex">
        <aside className="hidden min-h-screen w-64 shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 lg:sticky lg:top-0 lg:block">
          <div className="flex h-screen flex-col px-3 py-4">
            <div className="mb-5 flex items-center gap-2 px-2">
              <TrendingUp size={18} className="text-gray-700 dark:text-gray-200" />
              <div>
                <p className="font-display text-[0.95rem] font-semibold tracking-tight text-gray-950 dark:text-gray-50">Savings Planner</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Lokalny plan finansów</p>
              </div>
            </div>

            <AppNav activeTab={activeTab} onNavigate={navigate} />

            <div className={`mt-auto rounded-md border px-2.5 py-2 text-xs ${
              syncError
                ? 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-300'
                : 'border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400'
            }`}>
              <p className="font-medium">{syncLabel}</p>
              <p className="mt-1 text-gray-400 dark:text-gray-600">
                {BACKEND_MODE === 'api' ? '/api backend' : 'localStorage'}
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-gray-200 bg-[#f6f6f4] dark:border-gray-800 dark:bg-[#101113] lg:hidden">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex min-w-52 items-center gap-2">
                <TrendingUp size={18} className="text-gray-700 dark:text-gray-200" />
                <div>
                  <p className="font-display text-[0.95rem] font-semibold tracking-tight text-gray-950 dark:text-gray-50">Savings Planner</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Lokalny plan finansów</p>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto">
                <AppNav activeTab={activeTab} onNavigate={navigate} compact />
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
            {activeTab === 'overview' && <OverviewPage onNavigate={navigate} />}
            {activeTab === 'assets' && <AssetsPage />}
            {activeTab === 'plan' && <PlanPage />}
            {activeTab === 'transactions' && <TransactionsPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </main>

          <footer className="mx-auto max-w-[1680px] px-4 pb-6 text-center text-xs text-gray-400 dark:text-gray-600 sm:px-6 lg:px-8">
            {BACKEND_MODE === 'api'
              ? `Dane synchronizowane z backendem przez /api${syncError ? ' · wymaga uwagi' : ''}`
              : 'Dane lokalne w przeglądarce · brak serwera · brak telemetrii'}
          </footer>
        </div>
      </div>
    </div>
  )
}

function AppNav({ activeTab, onNavigate, compact = false }: { activeTab: AppTab; onNavigate: (tab: AppTab) => void; compact?: boolean }) {
  return (
    <nav className={compact ? 'flex items-center gap-1' : 'space-y-1'} aria-label="Główna nawigacja">
      {TABS.map(tab => {
        const Icon = tab.icon
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onNavigate(tab.id)}
            className={`${compact ? 'inline-flex' : 'flex w-full'} items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${
              active
                ? 'bg-white text-gray-950 shadow-sm ring-1 ring-black/[0.05] dark:bg-gray-800 dark:text-gray-50 dark:ring-white/[0.06]'
                : 'text-gray-600 hover:bg-white/60 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-100'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={16} />
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

function OverviewPage({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  useAccountSnapshotsOnDemand()
  const overview = useOverviewModel()

  return (
    <div className="space-y-5">
      <PageHeader
        title="Przegląd"
        description="Net worth, wolne środki i najbliższe elementy planu."
        icon={LayoutDashboard}
        accent="overview"
      />

      <NetWorthHero overview={overview} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dochód / mc" value={overview.monthlyIncome} detail={overview.cashflowMonthLabel} tone="positive" />
        <StatCard label="Koszty / mc" value={overview.monthlyCosts} detail={overview.costsDetail} tone="negative" />
        <StatCard label="Wolne środki / mc" value={overview.freeCash} detail={overview.freeCashDetail} tone={overview.freeCashTone} />
        <StatCard label="Poduszka bezpieczeństwa" value={overview.emergencyFund} detail={overview.emergencyFundLabel} tone="asset" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <SectionCard title="Net worth w czasie" description="Snapshoty kont minus bieżące saldo długów." icon={TrendingUp} accent="assets">
          <NetWorthChart
            accounts={overview.accounts}
            snapshots={overview.snapshots}
            loans={overview.loans}
            mortgagePlan={overview.mortgagePlan}
          />
        </SectionCard>
        <AssetsPie accounts={overview.accounts} snapshots={overview.snapshots} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Najbliższe cele" icon={ListChecks} accent="plan">
          {overview.nextGoals.length === 0 ? (
            <EmptyLine text="Brak aktywnych celów w planie." />
          ) : (
            <div className="space-y-2">
              {overview.nextGoals.map(goal => (
                <div key={goal.goalId} className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{goal.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {goal.completionMonth ? `ETA ${formatYearMonth(goal.completionMonth)}` : goal.projectedETA ? `Poza horyzontem: ${formatYearMonth(goal.projectedETA)}` : 'Brak alokacji'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">{formatPLN(goal.currentBalance)}</span>
                </div>
              ))}
            </div>
          )}
          <DomainButton onClick={() => onNavigate('plan')} label="Przejdź do planu" />
        </SectionCard>

        <SectionCard title="Nadchodzące wydatki" icon={CalendarClock} accent="plan">
          {overview.nextExpenses.length === 0 ? (
            <EmptyLine text="Brak nieopłaconych wydatków jednorazowych." />
          ) : (
            <div className="space-y-2">
              {overview.nextExpenses.map(expense => (
                <div key={expense.id} className="flex items-center justify-between gap-4 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{expense.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatYearMonth(expense.targetMonth)}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">{formatPLN(expense.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <DomainButton onClick={() => onNavigate('plan')} label="Otwórz cashflow" />
        </SectionCard>
      </div>
    </div>
  )
}

function AssetsPage() {
  useAccountSnapshotsOnDemand()
  return (
    <div className="space-y-5">
      <PageHeader title="Majątek" description="Snapshoty kont, struktura majątku i fundusz awaryjny." icon={WalletCards} accent="assets" />
      <AccountsSection />
    </div>
  )
}

function useAccountSnapshotsOnDemand() {
  const hasHydratedFromBackend = useStore(s => s.hasHydratedFromBackend)
  const hasLoadedAccountSnapshots = useStore(s => s.hasLoadedAccountSnapshots)
  const loadAccountSnapshots = useStore(s => s.loadAccountSnapshots)

  useEffect(() => {
    if (IS_API_MODE && hasHydratedFromBackend && !hasLoadedAccountSnapshots) {
      void loadAccountSnapshots()
    }
  }, [hasHydratedFromBackend, hasLoadedAccountSnapshots, loadAccountSnapshots])
}

function PlanPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Plan" description="Cashflow, cele, raty i harmonogram miesięczny." icon={BarChart3} accent="plan" />

      <SectionCard title="Miesięczny cashflow" description="Bazowe przychody, koszty życia i wolne środki po ratach." icon={CircleDollarSign} accent="plan">
        <Hero />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
        <SectionCard title="Prognoza celów i długów" icon={TrendingUp} accent="plan">
          <SavingsChart />
        </SectionCard>
        <SectionCard title="Symulacja what-if" icon={ReceiptText} accent="plan">
          <WhatIfSlider />
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Cele" icon={ListChecks} accent="plan">
          <GoalInsightsSection />
          <div className="my-4 border-t border-gray-200 dark:border-gray-800" />
          <GoalList />
        </SectionCard>
        <SectionCard title="Kredyty / raty" icon={ReceiptText} accent="plan">
          <LoanList />
        </SectionCard>
      </div>

      <SectionCard title="Kredyt hipoteczny" icon={Home} accent="plan">
        <MortgageSection />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Abonamenty" icon={Database} accent="plan">
          <SubscriptionList />
        </SectionCard>
        <SectionCard title="Nadchodzące wydatki" icon={CalendarClock} accent="plan">
          <UpcomingExpenseList />
        </SectionCard>
      </div>

      <SectionCard title="Harmonogram miesięczny" description="Nadpisania przychodów, kosztów i alokacji celów." icon={BarChart3} accent="plan">
        <ScheduleTable />
      </SectionCard>
    </div>
  )
}

function TransactionsPage() {
  const payPeriods = useStore(s => s.payPeriods)
  const [selectedPayPeriodKey, setSelectedPayPeriodKey] = useState('')
  const selectedPeriod = useMemo(
    () => payPeriods.find(period => periodKey(period) === selectedPayPeriodKey) ?? payPeriods[0],
    [payPeriods, selectedPayPeriodKey],
  )

  return (
    <div className="space-y-5">
      <PageHeader title="Transakcje" description="Cykle od wyplaty do wyplaty, kategorie i reczne przypisania operacji." icon={Tags} accent="assets" />
      <SectionCard title="Import wyciagu" description="CSV/PDF z banku wpada do transakcji, kategorii i cykli." icon={FileUp} accent="assets">
        <IngestSection />
      </SectionCard>
      <SectionCard title="Cykle budzetowe" icon={CalendarClock} accent="assets">
        <PayPeriodsSection selectedKey={selectedPayPeriodKey} onSelectedKeyChange={setSelectedPayPeriodKey} />
      </SectionCard>
      <SectionCard title="Analiza wycieku" description="Kategorie, cykliczne obciazenia, mikro-wydatki i wzrosty vs poprzednie cykle." icon={TrendingUp} accent="assets">
        <LeakAnalysisSection selectedPeriod={selectedPeriod} />
      </SectionCard>
      <SectionCard title="Kategoryzacja" icon={Tags} accent="assets">
        <CategorizationSection />
      </SectionCard>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Ustawienia" description="Horyzont planu, import/eksport i status backendu." icon={Settings} accent="settings" />
      <SectionCard title="Konfiguracja aplikacji" icon={ShieldCheck} accent="settings">
        <AdvancedSettings />
      </SectionCard>
    </div>
  )
}

function DomainButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 inline-flex items-center rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {label}
    </button>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">{text}</p>
}

function NetWorthHero({ overview }: { overview: ReturnType<typeof useOverviewModel> }) {
  const negative = overview.netWorthTone === 'negative'
  return (
    <div className={`${surface} overflow-hidden`}>
      <div className="grid gap-6 p-6 sm:grid-cols-[1.25fr_1fr] sm:p-7">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-gray-500 dark:text-gray-400">Net worth</p>
          <p className={`mt-2 font-display text-4xl font-semibold leading-none tnum sm:text-5xl ${negative ? 'text-rose-600 dark:text-rose-400' : 'text-gray-950 dark:text-gray-50'}`}>
            {overview.netWorth}
          </p>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {overview.netWorthDetail} · {overview.latestMonthLabel}
          </p>
          {negative && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Na minusie, bo net worth uwzględnia saldo kredytu hipotecznego.
            </p>
          )}
        </div>
        <div className="flex flex-col justify-center gap-2.5 sm:border-l sm:border-gray-200/70 sm:pl-6 sm:dark:border-gray-800">
          <BreakdownRow label="Majątek" value={overview.assetsValue} tone="asset" />
          <BreakdownRow label="Długi" value={`−${overview.debtValue}`} tone="negative" />
        </div>
      </div>
    </div>
  )
}

function BreakdownRow({ label, value, tone }: { label: string; value: string; tone: 'asset' | 'negative' }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`font-display text-lg font-semibold tnum ${tone === 'asset' ? 'text-teal-700 dark:text-teal-300' : 'text-rose-600 dark:text-rose-400'}`}>
        {value}
      </span>
    </div>
  )
}

function useOverviewModel() {
  const settings = useStore(s => s.settings)
  const goals = useStore(s => s.goals)
  const loans = useStore(s => s.loans)
  const accounts = useStore(s => s.accounts)
  const snapshots = useStore(s => s.accountSnapshots)
  const mortgagePlan = useStore(s => s.mortgagePlan)
  const subscriptions = useStore(s => s.subscriptions)
  const upcomingExpenses = useStore(s => s.upcomingExpenses)
  const overrides = useStore(s => s.overrides)

  const schedule = useMemo(
    () => buildSchedule(settings, goals, loans, overrides, 0, 0, mortgagePlan, subscriptions, upcomingExpenses),
    [settings, goals, loans, overrides, mortgagePlan, subscriptions, upcomingExpenses],
  )

  const months = allSnapshotMonths(snapshots)
  const latestMonth = months.at(-1)
  const previousMonth = months.at(-2)
  const totalAssets = latestMonth ? totalAssetsAsOf(accounts, snapshots, latestMonth) : 0
  const previousAssets = previousMonth ? totalAssetsAsOf(accounts, snapshots, previousMonth) : undefined
  const debt = loans.reduce((sum, loan) => sum + loan.remainingBalance, 0) + (mortgagePlan?.principal ?? 0)
  const netWorth = totalAssets - debt
  const netWorthDelta = previousAssets === undefined ? undefined : totalAssets - previousAssets
  const emergencyBuckets = settings.emergencyFundBuckets ?? []
  const emergencyFund = latestMonth ? sumBuckets(emergencyBuckets, latestMonth, accounts, snapshots) : 0
  const firstMonth = schedule.rows[0]
  const freeCash = firstMonth?.freeCash ?? settings.monthlyIncome - settings.monthlyExpenses
  const monthlyIncome = firstMonth?.income ?? settings.monthlyIncome
  const livingCosts = firstMonth?.expenses ?? settings.monthlyExpenses
  const subscriptionsCost = firstMonth?.subscriptionsTotal ?? 0
  const debtCost = (firstMonth?.loanPaymentsTotal ?? 0) + (firstMonth?.mortgagePaymentTotal ?? 0)
  const monthlyCosts = livingCosts + subscriptionsCost + debtCost
  const nextGoals = schedule.goalProgress.filter(goal => !goal.isComplete).slice(0, 4)
  const nextExpenses = upcomingExpenses
    .filter(expense => !expense.isPaid)
    .sort((a, b) => a.targetMonth.localeCompare(b.targetMonth))
    .slice(0, 4)
  const bucketLabel = emergencyBuckets.length > 0
    ? emergencyBuckets.map(bucket => BUCKET_LABELS[bucket]).join(' + ')
    : 'Brak bucketów'

  return {
    accounts,
    snapshots,
    loans,
    mortgagePlan,
    assets: formatPLN(totalAssets),
    netWorth: formatPLN(netWorth),
    netWorthDetail: netWorthDelta === undefined
      ? 'Brak poprzedniego snapshotu'
      : `${netWorthDelta >= 0 ? '+' : ''}${formatPLN(netWorthDelta)} m/m`,
    latestMonthLabel: latestMonth ? formatYearMonth(latestMonth) : 'Brak snapshotów',
    netWorthTone: netWorth < 0 ? 'negative' as const : 'asset' as const,
    assetsValue: formatPLN(totalAssets),
    debtValue: formatPLN(debt),
    monthlyIncome: `${formatPLN(monthlyIncome)}/mc`,
    monthlyCosts: `${formatPLN(monthlyCosts)}/mc`,
    costsDetail: `Życie ${formatPLN(livingCosts)} · Abon. ${formatPLN(subscriptionsCost)} · Raty ${formatPLN(debtCost)}`,
    cashflowMonthLabel: firstMonth ? formatYearMonth(firstMonth.yearMonth) : 'Pierwszy miesiąc',
    emergencyFund: formatPLN(emergencyFund),
    emergencyFundLabel: bucketLabel,
    freeCash: `${formatPLN(freeCash)}/mc`,
    freeCashDetail: firstMonth ? formatYearMonth(firstMonth.yearMonth) : 'Pierwszy miesiąc planu',
    freeCashTone: freeCash < 0 ? 'negative' as const : 'positive' as const,
    nextGoals,
    nextExpenses,
  }
}

function sumBuckets(bucketIds: AccountBucket[], yearMonth: string, accounts: Account[], snapshots: AccountSnapshot[]) {
  return accounts
    .filter(account => bucketIds.includes(account.bucket))
    .reduce((total, account) => total + balanceAsOf(snapshots, account, yearMonth), 0)
}
