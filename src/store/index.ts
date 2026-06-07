import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  accountsApi,
  categoriesApi,
  categoryRulesApi,
  goalsApi,
  goalInsightsApi,
  incomeAnchorsApi,
  ingestApi,
  importApi,
  leakAnalysisApi,
  loansApi,
  mortgageApi,
  overridesApi,
  payPeriodsApi,
  recategorizeApi,
  settingsApi,
  snapshotsApi,
  subscriptionsApi,
  transactionsApi,
  upcomingExpensesApi,
  type CsvImportMapping,
  type CsvImportResult,
} from '../api/client'
import { IS_API_MODE } from '../config'
import { buildSchedule } from '../domain/allocation'
import { earliestSnapshotMonth } from '../domain/accounts'
import { currentYearMonth } from '../domain/formatting'
import { createId } from '../domain/id'
import { ingestOrders } from '../domain/basket/inflationBasket'
import { parseOrderEmail } from '../domain/basket/parseOrderEmail'
import type {
  Account,
  AccountSnapshot,
  BankSource,
  BankTransaction,
  BasketConfig,
  BasketItem,
  Category,
  CategoryRule,
  CycleLeakAnalysis,
  Goal,
  GoalInsights,
  ImportSummary,
  IncomeAnchor,
  IncomeAnchorCandidate,
  IngestResult,
  Loan,
  PriceObservation,
  Settings,
  Overrides,
  PayPeriod,
  PayPeriodRefreshResult,
  PayPeriodSettings,
  RecategorizeResult,
  Schedule,
  MortgagePlan,
  Subscription,
  UpcomingExpense,
} from '../domain/types'
import { defaultBasketConfig } from '../domain/types'

interface DataState {
  /*
   * DataState = trwała domena aplikacji.
   * To są dane, które mają sens w eksporcie JSON, localStorage i backendzie.
   *
   * Angular porównanie:
   * Wyobraź sobie NgRx feature state albo serwis z BehaviorSubjectami.
   * Tutaj Zustand trzyma jeden obiekt stanu i akcje do jego zmiany.
   */
  settings: Settings
  goals: Goal[]
  loans: Loan[]
  accounts: Account[]
  accountSnapshots: AccountSnapshot[]
  categories: Category[]
  categoryRules: CategoryRule[]
  transactions: BankTransaction[]
  incomeAnchors: IncomeAnchor[]
  incomeAnchorCandidates: IncomeAnchorCandidate[]
  payPeriods: PayPeriod[]
  payPeriodSettings: PayPeriodSettings
  mortgagePlan?: MortgagePlan
  subscriptions: Subscription[]
  upcomingExpenses: UpcomingExpense[]
  overrides: Overrides
  basketItems: BasketItem[]
  priceObservations: PriceObservation[]
  basketConfig: BasketConfig
}

interface SyncState {
  /*
   * SyncState = metadane UI/synchronizacji.
   * Nie wysyłamy ich do backendu ani eksportu, bo opisują tylko aktualną sesję.
   */
  isHydrating: boolean
  hasHydratedFromBackend: boolean
  hasLoadedAccountSnapshots: boolean
  syncError?: string
  lastSyncedAt?: string
  leakAnalysis?: CycleLeakAnalysis
  cycleTransactions?: BankTransaction[]
  cycleTransactionsPeriod?: { accountId: string; periodNo: number }
  goalInsights?: GoalInsights
}

interface BootstrapResult {
  skipped: boolean
  message: string
}

interface HydrateOptions {
  includeAccountSnapshots?: boolean
}

interface CategorizationLoadOptions {
  onlyUncategorized?: boolean
  categoryId?: number
}

interface AppState extends DataState, SyncState {
  whatIfDelta: number
  loanOverpayment: number

  // API sync
  hydrateFromBackend: (options?: HydrateOptions) => Promise<void>
  bootstrapBackendFromLocal: () => Promise<BootstrapResult>
  importAccountSnapshotsCsv: (file: File, mapping: CsvImportMapping) => Promise<CsvImportResult>
  importBankStatement: (bank: BankSource, accountId: string, file: File) => Promise<IngestResult>
  loadAccountSnapshots: () => Promise<void>
  loadCategorization: (options?: boolean | CategorizationLoadOptions) => Promise<void>
  loadPayPeriods: () => Promise<void>
  loadLeakAnalysis: (accountId: string, periodNo: number) => Promise<void>
  loadCycleTransactions: (accountId: string, periodNo: number) => Promise<void>
  loadGoalInsights: (accountId?: string) => Promise<void>
  clearSyncError: () => void

  // Actions
  updateSettings: (patch: Partial<Settings>) => void
  addGoal: (goal: Omit<Goal, 'id' | 'priority'>) => void
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => void
  removeGoal: (id: string) => void
  reorderGoals: (orderedIds: string[]) => void
  addLoan: (loan: Omit<Loan, 'id'>) => void
  updateLoan: (id: string, patch: Partial<Omit<Loan, 'id'>>) => void
  removeLoan: (id: string) => void
  addAccount: (account: Omit<Account, 'id' | 'currency'> & { currency?: string }) => void
  updateAccount: (id: string, patch: Partial<Omit<Account, 'id'>>) => void
  removeAccount: (id: string) => void
  closeAccount: (id: string, yearMonth: string) => void
  reopenAccount: (id: string) => void
  setSnapshot: (accountId: string, yearMonth: string, balance: number, notes?: string) => void
  removeSnapshot: (accountId: string, yearMonth: string) => void
  addCategory: (category: Omit<Category, 'id'>) => void
  updateCategory: (id: number, patch: Partial<Omit<Category, 'id'>>) => void
  removeCategory: (id: number) => void
  addCategoryRule: (rule: Omit<CategoryRule, 'id' | 'source'> & { source?: CategoryRule['source'] }) => void
  updateCategoryRule: (id: number, patch: Partial<Omit<CategoryRule, 'id'>>) => void
  removeCategoryRule: (id: number) => void
  overrideTransactionCategory: (id: number, categoryId: number | undefined, locked?: boolean) => Promise<void>
  recategorizeTransactions: (accountId?: string, afterTransactionId?: number) => Promise<RecategorizeResult>
  addIncomeAnchor: (accountId: string, counterparty: string) => Promise<void>
  removeIncomeAnchor: (id: number) => Promise<void>
  refreshPayPeriods: () => Promise<PayPeriodRefreshResult>
  updatePayPeriodSettings: (settings: PayPeriodSettings) => Promise<void>
  saveMortgagePlan: (plan: Omit<MortgagePlan, 'id'> & { id?: string }) => void
  removeMortgagePlan: () => void
  addSubscription: (subscription: Omit<Subscription, 'id'>) => void
  updateSubscription: (id: string, patch: Partial<Omit<Subscription, 'id'>>) => void
  removeSubscription: (id: string) => void
  toggleSubscription: (id: string) => void
  addUpcomingExpense: (expense: Omit<UpcomingExpense, 'id'>) => void
  updateUpcomingExpense: (id: string, patch: Partial<Omit<UpcomingExpense, 'id'>>) => void
  removeUpcomingExpense: (id: string) => void
  toggleUpcomingPaid: (id: string) => void
  setOverride: (yearMonth: string, patch: Partial<Omit<Overrides[string], 'perGoalAllocation'>>) => void
  setGoalAllocationOverride: (yearMonth: string, goalId: string, amount: number | null) => void
  clearOverride: (yearMonth: string) => void
  setWhatIfDelta: (delta: number) => void
  setLoanOverpayment: (amount: number) => void
  exportData: () => string
  importData: (json: string) => void
  resetAll: () => void
  importBasketEmails: (files: File[]) => Promise<ImportSummary>
  setBasketConfig: (patch: Partial<BasketConfig>) => void
  setItemTracked: (id: string, tracked: boolean | null) => void
  mergeBasketItems: (targetId: string, sourceId: string) => void
  removeBasketItem: (id: string) => void

  // Derived (computed on every call)
  getSchedule: () => Schedule
  getWhatIfSchedule: () => Schedule
}

export const defaultSettings: Settings = {
  monthlyIncome: 10000,
  monthlyExpenses: 6000,
  startMonth: currentYearMonth(),
  horizonMonths: 36,
  emergencyFundBuckets: ['safety_cushion'],
  safetyCushionMonths: 6,
  emergencyFundTarget: 10000,
  ikzePlans: [],
  includeIkzeContributionsInCashflow: false,
}

/*
 * Fabryka pustego stanu.
 *
 * Dlaczego funkcja, a nie stała object?
 * Obiekty i tablice są referencjami. Funkcja daje świeże tablice przy resetach,
 * co zmniejsza ryzyko przypadkowego współdzielenia mutowalnych struktur.
 */
const emptyDataState = (): DataState => ({
  settings: defaultSettings,
  goals: [],
  loans: [],
  accounts: [],
  accountSnapshots: [],
  categories: [],
  categoryRules: [],
  transactions: [],
  incomeAnchors: [],
  incomeAnchorCandidates: [],
  payPeriods: [],
  payPeriodSettings: { minCycleDays: 14 },
  mortgagePlan: undefined,
  subscriptions: [],
  upcomingExpenses: [],
  overrides: {},
  basketItems: [],
  priceObservations: [],
  basketConfig: defaultBasketConfig,
})

/*
 * dataSnapshot robi płytką kopię trwałej części stanu.
 * Używamy tego przed optimistic update, żeby na błędzie API móc wrócić do
 * poprzednich danych.
 */
const dataSnapshot = (state: AppState): DataState => ({
  settings: state.settings,
  goals: state.goals,
  loans: state.loans,
  accounts: state.accounts,
  accountSnapshots: state.accountSnapshots,
  categories: state.categories,
  categoryRules: state.categoryRules,
  transactions: state.transactions,
  incomeAnchors: state.incomeAnchors,
  incomeAnchorCandidates: state.incomeAnchorCandidates,
  payPeriods: state.payPeriods,
  payPeriodSettings: state.payPeriodSettings,
  mortgagePlan: state.mortgagePlan,
  subscriptions: state.subscriptions,
  upcomingExpenses: state.upcomingExpenses,
  overrides: state.overrides,
  basketItems: state.basketItems,
  priceObservations: state.priceObservations,
  basketConfig: state.basketConfig,
})

const syncStamp = () => new Date().toISOString()

/*
 * Błędy z fetch/ApiError/Error/unknown sprowadzamy do tekstu dla UI.
 * W TypeScript catch ma typ unknown, bo JS może rzucić dowolną wartość:
 * throw "boom", throw 123, throw new Error(...).
 */
const describeSyncError = (error: unknown) =>
  error instanceof Error ? error.message : 'Nie udało się zsynchronizować danych z backendem.'

/*
 * POST bootstrap wysyła encje bez id.
 * Backend generuje canonical UUID, a frontend po bootstrappingu przeładowuje stan.
 *
 * Rekrutacyjnie:
 * To rozwiązuje problem source of truth. Nie próbujemy udawać, że frontendowe
 * tymczasowe id jest prawdą systemową.
 */
const withoutId = <T extends { id?: string }>(entity: T): Omit<T, 'id'> => {
  const { id, ...rest } = entity
  void id
  return rest
}

/*
 * Sprawdzanie "czy backend jest pusty" celowo ignoruje settings.
 * Hydratacja może wcześniej utworzyć domyślne settings na backendzie.
 * Dane biznesowe to kolekcje, singleton mortgage i overrides.
 */
const isBackendEmpty = async () => {
  const [accounts, loans, subscriptions, upcomingExpenses, goals, mortgagePlan, overrides] = await Promise.all([
    accountsApi.list(),
    loansApi.list(),
    subscriptionsApi.list(),
    upcomingExpensesApi.list(),
    goalsApi.list(),
    mortgageApi.get(),
    overridesApi.get(),
  ])

  return (
    accounts.length === 0 &&
    loans.length === 0 &&
    subscriptions.length === 0 &&
    upcomingExpenses.length === 0 &&
    goals.length === 0 &&
    mortgagePlan === undefined &&
    Object.keys(overrides).length === 0
  )
}

/*
 * W trybie API backend jest źródłem prawdy, więc nie chcemy nadpisywać starego
 * localStorage po hydratacji. Ale chcemy móc go odczytać do bootstrapu.
 *
 * Angular porównanie:
 * To trochę jak storage strategy w serwisie: w local mode zapisujesz do
 * localStorage, w api mode traktujesz localStorage tylko jako legacy import/cache.
 */
const localStorageAdapter = {
  getItem: (name: string) => globalThis.localStorage?.getItem(name) ?? null,
  setItem: (name: string, value: string) => {
    if (!IS_API_MODE) globalThis.localStorage?.setItem(name, value)
  },
  removeItem: (name: string) => globalThis.localStorage?.removeItem(name),
}

/*
 * Odczyt starego Zustand persist formatu:
 * { state: { ... }, version?: number }
 *
 * Dzięki temu po przełączeniu VITE_BACKEND=api użytkownik może nacisnąć
 * "Wyślij dane do bazy" i przenieść dane, które dotąd żyły w przeglądarce.
 */
const readPersistedLocalState = (): DataState | undefined => {
  const raw = globalThis.localStorage?.getItem('savings-planner-v1')
  if (!raw) return undefined

  try {
    const parsed = JSON.parse(raw) as { state?: Partial<DataState> }
    const state = parsed.state ?? {}
    return {
      settings: { ...defaultSettings, ...(state.settings ?? {}) },
      goals: state.goals ?? [],
      loans: state.loans ?? [],
      accounts: state.accounts ?? [],
      accountSnapshots: state.accountSnapshots ?? [],
      categories: state.categories ?? [],
      categoryRules: state.categoryRules ?? [],
      transactions: state.transactions ?? [],
      incomeAnchors: state.incomeAnchors ?? [],
      incomeAnchorCandidates: state.incomeAnchorCandidates ?? [],
      payPeriods: state.payPeriods ?? [],
      payPeriodSettings: state.payPeriodSettings ?? { minCycleDays: 14 },
      mortgagePlan: state.mortgagePlan,
      subscriptions: state.subscriptions ?? [],
      upcomingExpenses: state.upcomingExpenses ?? [],
      overrides: state.overrides ?? {},
      basketItems: state.basketItems ?? [],
      priceObservations: state.priceObservations ?? [],
      basketConfig: { ...defaultBasketConfig, ...(state.basketConfig ?? {}) },
    }
  } catch {
    return undefined
  }
}

/*
 * Overrides zawierają perGoalAllocation z kluczami goalId.
 * Przy bootstrapie cele dostają nowe backendowe UUID, więc trzeba przepiąć
 * override'y ze starych id na nowe.
 */
const remapGoalOverrides = (overrides: Overrides, goalIdMap: Map<string, string>): Overrides =>
  Object.fromEntries(
    Object.entries(overrides).map(([yearMonth, override]) => {
      const perGoalAllocation = override.perGoalAllocation
        ? Object.fromEntries(
            Object.entries(override.perGoalAllocation).map(([goalId, amount]) => [goalIdMap.get(goalId) ?? goalId, amount]),
          )
        : undefined

      return [
        yearMonth,
        perGoalAllocation ? { ...override, perGoalAllocation } : override,
      ]
    }),
  )

/*
 * Hydratacja = pobranie pełnego świata aplikacji z backendu.
 *
 * Backend nie ma endpointu "GET everything", więc składamy stan z kilku zasobów.
 * Snapshoty są pobierane per konto, bo kontrakt backendu ma historię pod kontem.
 */
async function loadBackendState(options: HydrateOptions = {}): Promise<DataState> {
  const [
    accounts,
    loans,
    subscriptions,
    upcomingExpenses,
    goals,
    mortgagePlan,
    settingsFromApi,
    overrides,
    categories,
    categoryRules,
    transactions,
    incomeAnchors,
    incomeAnchorCandidates,
    payPeriods,
    payPeriodSettings,
  ] =
    await Promise.all([
      accountsApi.list(),
      loansApi.list(),
      subscriptionsApi.list(),
      upcomingExpensesApi.list(),
      goalsApi.list(),
      mortgageApi.get(),
      settingsApi.get(),
      overridesApi.get(),
      categoriesApi.list(),
      categoryRulesApi.list(),
      transactionsApi.list({ limit: 200 }),
      incomeAnchorsApi.list(),
      incomeAnchorsApi.candidates(25),
      payPeriodsApi.list({ limit: 100 }),
      payPeriodsApi.settings(),
    ])

  /*
   * Snapshoty kont sa najwiekszym "fan-outem" tego bootstrapu: jeden request
   * per konto. Na zakladce Transakcje nie sa potrzebne, wiec mozemy je pominac
   * i dociagnac dopiero przy wejściu w Przeglad/Majatek.
   */
  const accountSnapshots = options.includeAccountSnapshots === false
    ? []
    : (await Promise.all(accounts.map(account => snapshotsApi.history(account.id)))).flat()
  const settings = settingsFromApi ?? await settingsApi.put(defaultSettings)

  return {
    settings,
    goals,
    loans,
    accounts,
    accountSnapshots,
    categories,
    categoryRules,
    transactions,
    incomeAnchors,
    incomeAnchorCandidates,
    payPeriods,
    payPeriodSettings,
    mortgagePlan,
    subscriptions,
    upcomingExpenses,
    overrides,
    basketItems: [],
    priceObservations: [],
    basketConfig: defaultBasketConfig,
  }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      /*
       * rollbackOnFailure to wspólny wzorzec optimistic update:
       * 1. zapamiętaj snapshot,
       * 2. zmień UI natychmiast,
       * 3. wyślij request,
       * 4. jeśli request padnie, przywróć snapshot i pokaż błąd.
       *
       * Angular porównanie:
       * W NgRx robiłbyś action optimistic + effect + success/failure action.
       * Zustand pozwala zrobić to bez całej infrastruktury akcji/reducerów.
       */
      const rollbackOnFailure = (snapshot: DataState, error: unknown) => {
        set({
          ...snapshot,
          syncError: describeSyncError(error),
          isHydrating: false,
        })
      }

      const markSynced = () => set({ syncError: undefined, lastSyncedAt: syncStamp() })

      /*
       * runMutation izoluje tryb API.
       * W local mode akcje kończą się na Zustand + persist localStorage.
       * W api mode ta sama akcja robi dodatkowy request.
       */
      const runMutation = (snapshot: DataState, mutation: () => Promise<unknown>) => {
        if (!IS_API_MODE) return
        void mutation().then(markSynced).catch(error => rollbackOnFailure(snapshot, error))
      }

      const putOverrides = (snapshot: DataState, overrides: Overrides) =>
        runMutation(snapshot, () => overridesApi.put(overrides))

      return {
        ...emptyDataState(),
        isHydrating: false,
        hasHydratedFromBackend: false,
        hasLoadedAccountSnapshots: false,
        syncError: undefined,
        lastSyncedAt: undefined,
        leakAnalysis: undefined,
        cycleTransactions: undefined,
        cycleTransactionsPeriod: undefined,
        goalInsights: undefined,
        whatIfDelta: 0,
        loanOverpayment: 0,

        hydrateFromBackend: async (options = {}) => {
          /*
           * useEffect w App woła tę metodę na starcie w trybie API.
           * Po sukcesie Zustand cache zostaje zastąpiony stanem z bazy.
           */
          if (!IS_API_MODE) return
          set({ isHydrating: true, syncError: undefined })
          try {
            const includeAccountSnapshots = options.includeAccountSnapshots !== false
            const [backendState, goalInsights] = await Promise.all([
              loadBackendState({ includeAccountSnapshots }),
              goalInsightsApi.summary({ cycles: 6 }).catch(() => undefined),
            ])
            set({
              ...backendState,
              /*
               * Gdy startujemy na Transakcjach, nie pobieramy snapshotow kont.
               * Nie zerujemy jednak dotychczasowego cache z localStorage, bo API
               * mode i local mode dziela ten sam persist. Ekrany majatku i tak
               * dociagna swieze snapshoty przed uzyciem.
               */
              accountSnapshots: includeAccountSnapshots ? backendState.accountSnapshots : get().accountSnapshots,
              goalInsights,
              isHydrating: false,
              hasHydratedFromBackend: true,
              hasLoadedAccountSnapshots: includeAccountSnapshots,
              syncError: undefined,
              lastSyncedAt: syncStamp(),
            })
          } catch (error) {
            set({
              isHydrating: false,
              hasHydratedFromBackend: false,
              syncError: describeSyncError(error),
            })
          }
        },

        bootstrapBackendFromLocal: async () => {
          /*
           * Bootstrap jest jednorazową migracją localStorage -> backend.
           * Jeśli backend ma dane biznesowe, zatrzymujemy operację zamiast
           * ryzykować duplikaty.
           */
          if (!IS_API_MODE) {
            return { skipped: true, message: 'Bootstrap jest dostępny tylko w trybie API.' }
          }

          const localState = readPersistedLocalState() ?? dataSnapshot(get())
          set({ isHydrating: true, syncError: undefined })

          try {
            if (!await isBackendEmpty()) {
              set({ isHydrating: false })
              return {
                skipped: true,
                message: 'Backend nie jest pusty, więc bootstrap został zatrzymany żeby nie zdublować danych.',
              }
            }

            await settingsApi.put(localState.settings)

            const accountIdMap = new Map<string, string>()
            for (const account of localState.accounts) {
              const created = await accountsApi.create(withoutId(account))
              accountIdMap.set(account.id, created.id)
            }

            for (const snapshot of localState.accountSnapshots) {
              const accountId = accountIdMap.get(snapshot.accountId) ?? snapshot.accountId
              await snapshotsApi.upsert(accountId, { ...snapshot, accountId })
            }

            const goalIdMap = new Map<string, string>()
            for (const goal of localState.goals) {
              const created = await goalsApi.create(withoutId(goal))
              goalIdMap.set(goal.id, created.id)
            }

            for (const loan of localState.loans) {
              await loansApi.create(withoutId(loan))
            }

            for (const subscription of localState.subscriptions) {
              await subscriptionsApi.create(withoutId(subscription))
            }

            for (const expense of localState.upcomingExpenses) {
              await upcomingExpensesApi.create(withoutId(expense))
            }

            if (localState.mortgagePlan) {
              await mortgageApi.put(localState.mortgagePlan)
            }

            await overridesApi.put(remapGoalOverrides(localState.overrides, goalIdMap))

            const backendState = await loadBackendState()
            set({
              ...backendState,
              isHydrating: false,
              hasHydratedFromBackend: true,
              hasLoadedAccountSnapshots: true,
              syncError: undefined,
              lastSyncedAt: syncStamp(),
            })
            return { skipped: false, message: 'Dane lokalne zostały wysłane do backendu.' }
          } catch (error) {
            set({
              ...localState,
              isHydrating: false,
              syncError: describeSyncError(error),
            })
            return { skipped: true, message: describeSyncError(error) }
          }
        },

        importAccountSnapshotsCsv: async (file, mapping) => {
          /*
           * Import CSV jest backendową operacją biznesową. Po imporcie nie próbujemy
           * lokalnie zgadywać zmian, tylko przeładowujemy pełny stan z backendu.
           */
          const result = await importApi.accountSnapshots(file, mapping)
          const backendState = await loadBackendState()
          set({
            ...backendState,
            hasHydratedFromBackend: true,
            hasLoadedAccountSnapshots: true,
            syncError: undefined,
            lastSyncedAt: syncStamp(),
          })
          return result
        },

        importBankStatement: async (bank, accountId, file) => {
          if (!IS_API_MODE) throw new Error('Import wyciagu bankowego jest dostepny tylko w trybie API.')
          set({ syncError: undefined })
          try {
            const result = await ingestApi.upload(bank, accountId, file)
            /*
             * The backend already categorizes and refreshes periods inside the
             * ingest transaction. The frontend still reloads both read models so
             * the screen shows the new facts instead of stale Zustand cache.
             */
            await Promise.all([
              get().loadCategorization(),
              get().loadPayPeriods(),
              get().loadGoalInsights(),
            ])
            set({ lastSyncedAt: syncStamp() })
            return result
          } catch (error) {
            set({ syncError: describeSyncError(error) })
            throw error
          }
        },

        loadAccountSnapshots: async () => {
          if (!IS_API_MODE) return
          const accounts = get().accounts
          if (accounts.length === 0) {
            set({ accountSnapshots: [], hasLoadedAccountSnapshots: true })
            return
          }

          set({ syncError: undefined })
          try {
            const accountSnapshots = (await Promise.all(accounts.map(account => snapshotsApi.history(account.id)))).flat()
            set({
              accountSnapshots,
              hasLoadedAccountSnapshots: true,
              lastSyncedAt: syncStamp(),
            })
          } catch (error) {
            set({ syncError: describeSyncError(error) })
          }
        },

        loadCategorization: async (options = {}) => {
          if (!IS_API_MODE) return
          const filters = typeof options === 'boolean'
            ? { onlyUncategorized: options }
            : options
          set({ syncError: undefined })
          try {
            const [categories, categoryRules, transactions] = await Promise.all([
              categoriesApi.list(),
              categoryRulesApi.list(),
              transactionsApi.list({
                onlyUncategorized: filters.onlyUncategorized,
                categoryId: filters.categoryId,
                limit: 200,
              }),
            ])
            set({ categories, categoryRules, transactions, lastSyncedAt: syncStamp() })
          } catch (error) {
            set({ syncError: describeSyncError(error) })
          }
        },

        loadPayPeriods: async () => {
          if (!IS_API_MODE) return
          set({ syncError: undefined })
          try {
            const [incomeAnchors, incomeAnchorCandidates, payPeriods, payPeriodSettings] = await Promise.all([
              incomeAnchorsApi.list(),
              incomeAnchorsApi.candidates(25),
              payPeriodsApi.list({ limit: 100 }),
              payPeriodsApi.settings(),
            ])
            set({ incomeAnchors, incomeAnchorCandidates, payPeriods, payPeriodSettings, lastSyncedAt: syncStamp() })
          } catch (error) {
            set({ syncError: describeSyncError(error) })
          }
        },

        loadLeakAnalysis: async (accountId, periodNo) => {
          if (!IS_API_MODE) return
          set({ syncError: undefined })
          try {
            const leakAnalysis = await leakAnalysisApi.cycle(accountId, periodNo)
            set({ leakAnalysis, lastSyncedAt: syncStamp() })
          } catch (error) {
            set({ leakAnalysis: undefined, syncError: describeSyncError(error) })
          }
        },

        loadCycleTransactions: async (accountId, periodNo) => {
          if (!IS_API_MODE) return
          set({ syncError: undefined })
          try {
            const cycleTransactions = await transactionsApi.list({ accountId, periodNo, limit: 5000 })
            set({
              cycleTransactions,
              cycleTransactionsPeriod: { accountId, periodNo },
              lastSyncedAt: syncStamp(),
            })
          } catch (error) {
            set({
              cycleTransactions: undefined,
              cycleTransactionsPeriod: undefined,
              syncError: describeSyncError(error),
            })
          }
        },

        loadGoalInsights: async (accountId) => {
          if (!IS_API_MODE) return
          set({ syncError: undefined })
          try {
            const goalInsights = await goalInsightsApi.summary({ accountId, cycles: 6 })
            set({ goalInsights, lastSyncedAt: syncStamp() })
          } catch (error) {
            set({ goalInsights: undefined, syncError: describeSyncError(error) })
          }
        },

        clearSyncError: () => set({ syncError: undefined }),

        updateSettings: (patch) => {
          /*
           * patch = Partial<Settings>, czyli obiekt z dowolnym podzbiorem pól.
           * JS spread tworzy nowy obiekt:
           * { ...old, ...patch } = stare pola + nadpisane pola z patch.
           *
           * React/Zustand ważne:
           * Nie mutujemy s.settings.monthlyIncome = x. Tworzymy nowy obiekt,
           * żeby subskrypcje widziały zmianę referencji.
           */
          const snapshot = dataSnapshot(get())
          const settings = { ...get().settings, ...patch }
          set({ settings })
          runMutation(snapshot, () => settingsApi.put(settings))
        },

        addGoal: (goalData) => {
          /*
           * Komponent wywołuje addGoal bez id i priority.
           * Store dopowiada pola techniczne, dzięki czemu formularz zna tylko
           * dane użytkownika.
           */
          const snapshot = dataSnapshot(get())
          const maxPriority = get().goals.reduce((m, g) => Math.max(m, g.priority), 0)
          const goal: Goal = { ...goalData, id: createId(), priority: maxPriority + 1 }
          set(s => ({ goals: [...s.goals, goal] }))

          if (IS_API_MODE) {
            /*
             * W API mode tymczasowe frontend id zostanie zastąpione id z backendu.
             * Dla użytkownika UI reaguje natychmiast, a spójność id dochodzi po POST.
             */
            void goalsApi.create(withoutId(goal))
              .then(created => set(s => ({
                goals: s.goals.map(item => item.id === goal.id ? created : item),
                syncError: undefined,
                lastSyncedAt: syncStamp(),
              })))
              .catch(error => rollbackOnFailure(snapshot, error))
          }
        },

        updateGoal: (id, patch) => {
          const snapshot = dataSnapshot(get())
          const goal = get().goals.find(item => item.id === id)
          if (!goal) return
          const updated = { ...goal, ...patch }
          set(s => ({ goals: s.goals.map(item => item.id === id ? updated : item) }))
          runMutation(snapshot, () => goalsApi.update(id, updated))
        },

        removeGoal: (id) => {
          const snapshot = dataSnapshot(get())
          set(s => ({ goals: s.goals.filter(goal => goal.id !== id) }))
          runMutation(snapshot, () => goalsApi.remove(id))
        },

        reorderGoals: (orderedIds) => {
          /*
           * Drag-and-drop zwraca kolejność id. Store przelicza priority na 1..N,
           * bo backend i allocation engine rozumieją priorytet jako liczbę.
           */
          const snapshot = dataSnapshot(get())
          const goals = orderedIds.map((id, index) => {
            const goal = get().goals.find(item => item.id === id)!
            return { ...goal, priority: index + 1 }
          })
          set({ goals })
          runMutation(snapshot, () => Promise.all(goals.map(goal => goalsApi.update(goal.id, goal))))
        },

        addLoan: (loanData) => {
          const snapshot = dataSnapshot(get())
          const loan: Loan = { ...loanData, id: createId() }
          set(s => ({ loans: [...s.loans, loan] }))

          if (IS_API_MODE) {
            void loansApi.create(withoutId(loan))
              .then(created => set(s => ({
                loans: s.loans.map(item => item.id === loan.id ? created : item),
                syncError: undefined,
                lastSyncedAt: syncStamp(),
              })))
              .catch(error => rollbackOnFailure(snapshot, error))
          }
        },

        updateLoan: (id, patch) => {
          const snapshot = dataSnapshot(get())
          const loan = get().loans.find(item => item.id === id)
          if (!loan) return
          const updated = { ...loan, ...patch }
          set(s => ({ loans: s.loans.map(item => item.id === id ? updated : item) }))
          runMutation(snapshot, () => loansApi.update(id, updated))
        },

        removeLoan: (id) => {
          const snapshot = dataSnapshot(get())
          set(s => ({ loans: s.loans.filter(loan => loan.id !== id) }))
          runMutation(snapshot, () => loansApi.remove(id))
        },

        addAccount: (accountData) => {
          const snapshot = dataSnapshot(get())
          const account: Account = { ...accountData, currency: accountData.currency ?? 'PLN', id: createId() }
          set(s => ({ accounts: [...s.accounts, account] }))

          if (IS_API_MODE) {
            void accountsApi.create(withoutId(account))
              .then(created => set(s => ({
                accounts: s.accounts.map(item => item.id === account.id ? created : item),
                accountSnapshots: s.accountSnapshots.map(item =>
                  item.accountId === account.id ? { ...item, accountId: created.id } : item,
                ),
                syncError: undefined,
                lastSyncedAt: syncStamp(),
              })))
              .catch(error => rollbackOnFailure(snapshot, error))
          }
        },

        updateAccount: (id, patch) => {
          const snapshot = dataSnapshot(get())
          const account = get().accounts.find(item => item.id === id)
          if (!account) return
          const updated = { ...account, ...patch }
          set(s => ({ accounts: s.accounts.map(item => item.id === id ? updated : item) }))
          runMutation(snapshot, () => accountsApi.update(id, updated))
        },

        removeAccount: (id) => {
          const snapshot = dataSnapshot(get())
          set(s => ({
            accounts: s.accounts.filter(account => account.id !== id),
            accountSnapshots: s.accountSnapshots.filter(snapshot => snapshot.accountId !== id),
          }))
          runMutation(snapshot, () => accountsApi.remove(id))
        },

        closeAccount: (id, yearMonth) => {
          get().updateAccount(id, { closedAt: yearMonth })
        },

        reopenAccount: (id) => {
          get().updateAccount(id, { closedAt: undefined })
        },

        setSnapshot: (accountId, yearMonth, balance, notes) => {
          /*
           * Snapshot ma naturalny klucz: accountId + yearMonth.
           * Dlatego endpoint backendu używa PUT, a nie POST: ustawiamy konkretny
           * stan miesiąca i operację można powtórzyć idempotentnie.
           */
          const snapshot = dataSnapshot(get())
          const accountSnapshot: AccountSnapshot = { accountId, yearMonth, balance, notes }
          let nextSnapshots: AccountSnapshot[] = []

          set(s => {
            const exists = s.accountSnapshots.some(item => item.accountId === accountId && item.yearMonth === yearMonth)
            nextSnapshots = exists
              ? s.accountSnapshots.map(item =>
                  item.accountId === accountId && item.yearMonth === yearMonth ? accountSnapshot : item,
                )
              : [...s.accountSnapshots, accountSnapshot]
            const openedAt = earliestSnapshotMonth(nextSnapshots, accountId)

            return {
              accountSnapshots: nextSnapshots,
              accounts: s.accounts.map(account => account.id === accountId ? { ...account, openedAt } : account),
            }
          })

          runMutation(snapshot, () => snapshotsApi.upsert(accountId, accountSnapshot))
        },

        removeSnapshot: (accountId, yearMonth) => {
          const snapshot = dataSnapshot(get())
          let nextSnapshots: AccountSnapshot[] = []

          set(s => {
            nextSnapshots = s.accountSnapshots.filter(
              item => !(item.accountId === accountId && item.yearMonth === yearMonth),
            )
            const openedAt = earliestSnapshotMonth(nextSnapshots, accountId)

            return {
              accountSnapshots: nextSnapshots,
              accounts: s.accounts.map(account => account.id === accountId ? { ...account, openedAt } : account),
            }
          })

          runMutation(snapshot, () => snapshotsApi.remove(accountId, yearMonth))
        },

        addCategory: (categoryData) => {
          const snapshot = dataSnapshot(get())
          const category: Category = { ...categoryData, id: Date.now() }
          set(s => ({ categories: [...s.categories, category] }))

          if (IS_API_MODE) {
            void categoriesApi.create(categoryData)
              .then(created => set(s => ({
                categories: s.categories.map(item => item.id === category.id ? created : item),
                syncError: undefined,
                lastSyncedAt: syncStamp(),
              })))
              .catch(error => rollbackOnFailure(snapshot, error))
          }
        },

        updateCategory: (id, patch) => {
          const snapshot = dataSnapshot(get())
          const category = get().categories.find(item => item.id === id)
          if (!category) return
          const updated = { ...category, ...patch }
          set(s => ({ categories: s.categories.map(item => item.id === id ? updated : item) }))
          runMutation(snapshot, () => categoriesApi.update(id, updated))
        },

        removeCategory: (id) => {
          const snapshot = dataSnapshot(get())
          set(s => ({
            categories: s.categories.filter(category => category.id !== id),
            categoryRules: s.categoryRules.filter(rule => rule.categoryId !== id),
          }))
          runMutation(snapshot, () => categoriesApi.remove(id))
        },

        addCategoryRule: (ruleData) => {
          const snapshot = dataSnapshot(get())
          const rule: CategoryRule = { ...ruleData, id: Date.now(), source: ruleData.source ?? 'manual' }
          set(s => ({ categoryRules: [...s.categoryRules, rule].sort((a, b) => a.priority - b.priority || a.id - b.id) }))

          if (IS_API_MODE) {
            void categoryRulesApi.create({ ...ruleData, source: rule.source })
              .then(created => set(s => ({
                categoryRules: [...s.categoryRules.filter(item => item.id !== rule.id), created]
                  .sort((a, b) => a.priority - b.priority || a.id - b.id),
                syncError: undefined,
                lastSyncedAt: syncStamp(),
              })))
              .catch(error => rollbackOnFailure(snapshot, error))
          }
        },

        updateCategoryRule: (id, patch) => {
          const snapshot = dataSnapshot(get())
          const rule = get().categoryRules.find(item => item.id === id)
          if (!rule) return
          const updated = { ...rule, ...patch }
          set(s => ({
            categoryRules: s.categoryRules
              .map(item => item.id === id ? updated : item)
              .sort((a, b) => a.priority - b.priority || a.id - b.id),
          }))
          runMutation(snapshot, () => categoryRulesApi.update(id, updated))
        },

        removeCategoryRule: (id) => {
          const snapshot = dataSnapshot(get())
          set(s => ({ categoryRules: s.categoryRules.filter(rule => rule.id !== id) }))
          runMutation(snapshot, () => categoryRulesApi.remove(id))
        },

        overrideTransactionCategory: async (id, categoryId, locked = true) => {
          const snapshot = dataSnapshot(get())
          set(s => ({
            transactions: s.transactions.map(transaction =>
              transaction.id === id ? { ...transaction, categoryId, categoryLocked: locked } : transaction,
            ),
            cycleTransactions: s.cycleTransactions?.map(transaction =>
              transaction.id === id ? { ...transaction, categoryId, categoryLocked: locked } : transaction,
            ),
          }))
          if (!IS_API_MODE) return
          try {
            await transactionsApi.overrideCategory(id, categoryId, locked)
            markSynced()
          } catch (error) {
            rollbackOnFailure(snapshot, error)
          }
        },

        recategorizeTransactions: async (accountId, afterTransactionId) => {
          if (!IS_API_MODE) return { categorized: 0, total: 0 }
          set({ syncError: undefined })
          try {
            const result = await recategorizeApi.run({ accountId, afterTransactionId })
            const transactions = await transactionsApi.list({ limit: 200 })
            set({ transactions, lastSyncedAt: syncStamp() })
            return result
          } catch (error) {
            set({ syncError: describeSyncError(error) })
            return { categorized: 0, total: 0 }
          }
        },

        addIncomeAnchor: async (accountId, counterparty) => {
          if (!IS_API_MODE) return
          set({ syncError: undefined })
          try {
            await incomeAnchorsApi.create({ accountId, counterparty })
            await get().loadPayPeriods()
            await get().loadGoalInsights(accountId)
          } catch (error) {
            set({ syncError: describeSyncError(error) })
          }
        },

        removeIncomeAnchor: async (id) => {
          if (!IS_API_MODE) return
          set({ syncError: undefined })
          try {
            await incomeAnchorsApi.remove(id)
            await get().loadPayPeriods()
            await get().loadGoalInsights()
          } catch (error) {
            set({ syncError: describeSyncError(error) })
          }
        },

        refreshPayPeriods: async () => {
          if (!IS_API_MODE) return { periods: 0 }
          set({ syncError: undefined })
          try {
            const result = await payPeriodsApi.refresh()
            await get().loadPayPeriods()
            await get().loadGoalInsights()
            return result
          } catch (error) {
            set({ syncError: describeSyncError(error) })
            return { periods: 0 }
          }
        },

        updatePayPeriodSettings: async (payPeriodSettings) => {
          if (!IS_API_MODE) return
          set({ payPeriodSettings, syncError: undefined })
          try {
            const updated = await payPeriodsApi.updateSettings(payPeriodSettings)
            await get().loadPayPeriods()
            await get().loadGoalInsights()
            set({ payPeriodSettings: updated, lastSyncedAt: syncStamp() })
          } catch (error) {
            set({ syncError: describeSyncError(error) })
          }
        },

        saveMortgagePlan: (planData) => {
          const snapshot = dataSnapshot(get())
          const mortgagePlan: MortgagePlan = {
            ...planData,
            id: planData.id ?? get().mortgagePlan?.id ?? createId(),
          }
          set({ mortgagePlan })
          runMutation(snapshot, () => mortgageApi.put(mortgagePlan))
        },

        removeMortgagePlan: () => {
          const snapshot = dataSnapshot(get())
          set({ mortgagePlan: undefined })
          runMutation(snapshot, () => mortgageApi.remove())
        },

        addSubscription: (subscriptionData) => {
          const snapshot = dataSnapshot(get())
          const subscription: Subscription = { ...subscriptionData, id: createId() }
          set(s => ({ subscriptions: [...s.subscriptions, subscription] }))

          if (IS_API_MODE) {
            void subscriptionsApi.create(withoutId(subscription))
              .then(created => set(s => ({
                subscriptions: s.subscriptions.map(item => item.id === subscription.id ? created : item),
                syncError: undefined,
                lastSyncedAt: syncStamp(),
              })))
              .catch(error => rollbackOnFailure(snapshot, error))
          }
        },

        updateSubscription: (id, patch) => {
          const snapshot = dataSnapshot(get())
          const subscription = get().subscriptions.find(item => item.id === id)
          if (!subscription) return
          const updated = { ...subscription, ...patch }
          set(s => ({ subscriptions: s.subscriptions.map(item => item.id === id ? updated : item) }))
          runMutation(snapshot, () => subscriptionsApi.update(id, updated))
        },

        removeSubscription: (id) => {
          const snapshot = dataSnapshot(get())
          set(s => ({ subscriptions: s.subscriptions.filter(subscription => subscription.id !== id) }))
          runMutation(snapshot, () => subscriptionsApi.remove(id))
        },

        toggleSubscription: (id) => {
          const subscription = get().subscriptions.find(item => item.id === id)
          if (!subscription) return
          get().updateSubscription(id, { active: !subscription.active })
        },

        addUpcomingExpense: (expenseData) => {
          const snapshot = dataSnapshot(get())
          const expense: UpcomingExpense = { ...expenseData, id: createId() }
          set(s => ({ upcomingExpenses: [...s.upcomingExpenses, expense] }))

          if (IS_API_MODE) {
            void upcomingExpensesApi.create(withoutId(expense))
              .then(created => set(s => ({
                upcomingExpenses: s.upcomingExpenses.map(item => item.id === expense.id ? created : item),
                syncError: undefined,
                lastSyncedAt: syncStamp(),
              })))
              .catch(error => rollbackOnFailure(snapshot, error))
          }
        },

        updateUpcomingExpense: (id, patch) => {
          const snapshot = dataSnapshot(get())
          const expense = get().upcomingExpenses.find(item => item.id === id)
          if (!expense) return
          const updated = { ...expense, ...patch }
          set(s => ({ upcomingExpenses: s.upcomingExpenses.map(item => item.id === id ? updated : item) }))
          runMutation(snapshot, () => upcomingExpensesApi.update(id, updated))
        },

        removeUpcomingExpense: (id) => {
          const snapshot = dataSnapshot(get())
          set(s => ({ upcomingExpenses: s.upcomingExpenses.filter(expense => expense.id !== id) }))
          runMutation(snapshot, () => upcomingExpensesApi.remove(id))
        },

        toggleUpcomingPaid: (id) => {
          const expense = get().upcomingExpenses.find(item => item.id === id)
          if (!expense) return
          get().updateUpcomingExpense(id, { isPaid: !expense.isPaid })
        },

        setOverride: (yearMonth, patch) => {
          const snapshot = dataSnapshot(get())
          const overrides = {
            ...get().overrides,
            [yearMonth]: { ...get().overrides[yearMonth], ...patch },
          }
          set({ overrides })
          putOverrides(snapshot, overrides)
        },

        setGoalAllocationOverride: (yearMonth, goalId, amount) => {
          /*
           * amount === null oznacza "usuń override".
           * W JS null/undefined często są mylone:
           * - null: świadomie brak wartości,
           * - undefined: pole nieustawione / pominięte.
           * Tu używamy null jako komendy API funkcji.
           */
          const snapshot = dataSnapshot(get())
          const current = get().overrides[yearMonth] ?? {}
          const perGoal = { ...(current.perGoalAllocation ?? {}) }
          if (amount === null) {
            delete perGoal[goalId]
          } else {
            perGoal[goalId] = amount
          }
          const withoutPerGoal = Object.fromEntries(
            Object.entries(current).filter(([key]) => key !== 'perGoalAllocation'),
          )
          const updated = Object.keys(perGoal).length === 0
            ? withoutPerGoal
            : { ...current, perGoalAllocation: perGoal }
          const overrides = { ...get().overrides, [yearMonth]: updated }
          set({ overrides })
          putOverrides(snapshot, overrides)
        },

        clearOverride: (yearMonth) => {
          const snapshot = dataSnapshot(get())
          const overrides = Object.fromEntries(
            Object.entries(get().overrides).filter(([key]) => key !== yearMonth),
          )
          set({ overrides })
          putOverrides(snapshot, overrides)
        },

        setWhatIfDelta: (delta) => set({ whatIfDelta: delta }),
        setLoanOverpayment: (amount) => set({ loanOverpayment: amount }),

        importBasketEmails: async (files) => {
          const summary: ImportSummary = {
            filesTotal: files.length,
            filesOk: 0,
            filesError: [],
            ordersParsed: 0,
            itemsNew: 0,
            observationsAdded: 0,
            observationsDuplicate: 0,
          }

          const readFileText = (file: File): Promise<string> =>
            new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = () => reject(reader.error)
              reader.readAsText(file, 'utf-8')
            })

          const reads = await Promise.all(
            files.map(async (file) => {
              try {
                const content = await readFileText(file)
                return { ok: true as const, content, name: file.name }
              } catch {
                return { ok: false as const, name: file.name, reason: 'Błąd odczytu pliku' }
              }
            }),
          )

          const orders = reads.map(r => {
            if (!r.ok) {
              summary.filesError.push({ name: r.name, reason: r.reason })
              return null
            }
            const order = parseOrderEmail(r.content)
            if (order.ok) {
              summary.filesOk++
            } else {
              summary.filesError.push({ name: r.name, reason: order.reason })
            }
            return order
          }).filter(o => o !== null)

          const state = get()
          const { items, observations, stats } = ingestOrders(
            orders,
            { items: state.basketItems, observations: state.priceObservations },
            state.basketConfig.trackingThreshold,
          )
          set({ basketItems: items, priceObservations: observations })

          summary.ordersParsed = stats.ordersParsed
          summary.itemsNew = stats.itemsNew
          summary.observationsAdded = stats.observationsAdded
          summary.observationsDuplicate = stats.observationsDuplicate
          return summary
        },

        setBasketConfig: (patch) => {
          set(s => {
            const basketConfig = { ...s.basketConfig, ...patch }
            const countPerItem = new Map<string, number>()
            for (const obs of s.priceObservations) {
              countPerItem.set(obs.itemId, (countPerItem.get(obs.itemId) ?? 0) + 1)
            }
            const basketItems = s.basketItems.map(item => ({
              ...item,
              tracked: item.trackedManual ?? (countPerItem.get(item.id) ?? 0) >= basketConfig.trackingThreshold,
            }))
            return { basketConfig, basketItems }
          })
        },

        setItemTracked: (id, tracked) => {
          set(s => {
            const count = s.priceObservations.filter(o => o.itemId === id).length
            const autoTracked = count >= s.basketConfig.trackingThreshold
            return {
              basketItems: s.basketItems.map(item => {
                if (item.id !== id) return item
                if (tracked === null) {
                  return { ...item, trackedManual: undefined, tracked: autoTracked }
                }
                return { ...item, trackedManual: tracked, tracked }
              }),
            }
          })
        },

        mergeBasketItems: (targetId, sourceId) => {
          set(s => {
            const target = s.basketItems.find(i => i.id === targetId)
            const source = s.basketItems.find(i => i.id === sourceId)
            if (!target || !source) return {}

            const allAliases = [...target.aliases, source.normalizedName, ...source.aliases]
            const uniqueAliases = allAliases.filter((a, idx, arr) => arr.indexOf(a) === idx)

            const updatedObs = s.priceObservations.map(o =>
              o.itemId === sourceId ? { ...o, itemId: targetId } : o,
            )
            const targetCount = updatedObs.filter(o => o.itemId === targetId).length
            const updatedTarget: BasketItem = {
              ...target,
              aliases: uniqueAliases,
              tracked: target.trackedManual ?? targetCount >= s.basketConfig.trackingThreshold,
            }

            return {
              basketItems: s.basketItems
                .filter(i => i.id !== sourceId)
                .map(i => (i.id === targetId ? updatedTarget : i)),
              priceObservations: updatedObs,
            }
          })
        },

        removeBasketItem: (id) => {
          set(s => ({
            basketItems: s.basketItems.filter(i => i.id !== id),
            priceObservations: s.priceObservations.filter(o => o.itemId !== id),
          }))
        },

        exportData: () => JSON.stringify(dataSnapshot(get()), null, 2),

        importData: (json) => {
          /*
           * JSON import zostaje pełny w local mode.
           * W API mode nie pokazujemy przycisku importu JSON w UI, bo backend jest
           * źródłem prawdy. Ta metoda zostaje dla kompatybilności testów i eksportu.
           */
          const snapshot = dataSnapshot(get())
          const data = JSON.parse(json)
          const imported: DataState = {
            settings: { ...defaultSettings, ...(data.settings ?? {}) },
            goals: data.goals ?? [],
            loans: data.loans ?? [],
            accounts: data.accounts ?? [],
            accountSnapshots: data.accountSnapshots ?? [],
            categories: data.categories ?? [],
            categoryRules: data.categoryRules ?? [],
            transactions: data.transactions ?? [],
            incomeAnchors: data.incomeAnchors ?? [],
            incomeAnchorCandidates: data.incomeAnchorCandidates ?? [],
            payPeriods: data.payPeriods ?? [],
            payPeriodSettings: data.payPeriodSettings ?? { minCycleDays: 14 },
            mortgagePlan: data.mortgagePlan,
            subscriptions: data.subscriptions ?? [],
            upcomingExpenses: data.upcomingExpenses ?? [],
            overrides: data.overrides ?? {},
            basketItems: data.basketItems ?? [],
            priceObservations: data.priceObservations ?? [],
            basketConfig: { ...defaultBasketConfig, ...(data.basketConfig ?? {}) },
          }
          set(imported)

          if (IS_API_MODE) {
            void (async () => {
              await settingsApi.put(imported.settings)
              if (imported.mortgagePlan) await mortgageApi.put(imported.mortgagePlan)
              await overridesApi.put(imported.overrides)
            })().then(markSynced).catch(error => rollbackOnFailure(snapshot, error))
          }
        },

        resetAll: () => {
          /*
           * Reset w API mode usuwa zasoby w kolejności bezpiecznej dla relacji:
           * najpierw snapshoty, potem konta, potem reszta kolekcji/singletonów.
           */
          const snapshot = dataSnapshot(get())
          set({
            ...emptyDataState(),
            whatIfDelta: 0,
            loanOverpayment: 0,
          })

          if (IS_API_MODE) {
            const mutation = async () => {
              await Promise.all(snapshot.accountSnapshots.map(item => snapshotsApi.remove(item.accountId, item.yearMonth)))
              await Promise.all(snapshot.accounts.map(item => accountsApi.remove(item.id)))
              await Promise.all(snapshot.goals.map(item => goalsApi.remove(item.id)))
              await Promise.all(snapshot.loans.map(item => loansApi.remove(item.id)))
              await Promise.all(snapshot.subscriptions.map(item => subscriptionsApi.remove(item.id)))
              await Promise.all(snapshot.upcomingExpenses.map(item => upcomingExpensesApi.remove(item.id)))
              if (snapshot.mortgagePlan) await mortgageApi.remove()
              await settingsApi.put(defaultSettings)
              await overridesApi.put({})
            }
            runMutation(snapshot, mutation)
          }
        },

        getSchedule: () => {
          const { settings, goals, loans, mortgagePlan, subscriptions, upcomingExpenses, overrides } = get()
          return buildSchedule(settings, goals, loans, overrides, 0, 0, mortgagePlan, subscriptions, upcomingExpenses)
        },

        getWhatIfSchedule: () => {
          const {
            settings,
            goals,
            loans,
            mortgagePlan,
            subscriptions,
            upcomingExpenses,
            overrides,
            whatIfDelta,
            loanOverpayment,
          } = get()
          return buildSchedule(
            settings,
            goals,
            loans,
            overrides,
            whatIfDelta,
            loanOverpayment,
            mortgagePlan,
            subscriptions,
            upcomingExpenses,
          )
        },
      }
    },
    {
      name: 'savings-planner-v1',
      storage: createJSONStorage(() => localStorageAdapter),
      partialize: (s) => ({
        settings: s.settings,
        goals: s.goals,
        loans: s.loans,
        accounts: s.accounts,
        accountSnapshots: s.accountSnapshots,
        categories: s.categories,
        categoryRules: s.categoryRules,
        mortgagePlan: s.mortgagePlan,
        subscriptions: s.subscriptions,
        upcomingExpenses: s.upcomingExpenses,
        overrides: s.overrides,
        basketItems: s.basketItems,
        priceObservations: s.priceObservations,
        basketConfig: s.basketConfig,
      }),
    },
  ),
)
