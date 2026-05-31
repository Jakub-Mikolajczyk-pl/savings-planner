import { API_BASE_URL, API_TOKEN } from '../config'
import type {
  Account,
  AccountBucket,
  AccountSnapshot,
  BankTransaction,
  Category,
  CategoryRule,
  Goal,
  IncomeAnchor,
  IncomeAnchorCandidate,
  Loan,
  MortgagePlan,
  Overrides,
  PayPeriod,
  PayPeriodRefreshResult,
  PayPeriodSettings,
  RecategorizeResult,
  Settings,
  Subscription,
  UpcomingExpense,
} from '../domain/types'

type RequestBody = object | unknown[] | string | number | boolean | null

/*
 * Własny typ błędu API.
 *
 * Dlaczego nie rzucać zwykłego Error?
 * Bo UI/sync czasem musi wiedzieć, czy to było 404, 401 czy 500.
 * Przykład: singletony settings/mortgage-plan traktują 404 jako "brak danych",
 * a nie jako awarię.
 *
 * Angular porównanie:
 * HttpClient rzuca HttpErrorResponse z polem status. Tutaj budujemy bardzo
 * mały odpowiednik dla fetch().
 */
export class ApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(
    status: number,
    message: string,
    details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

/*
 * Typy importu CSV są frontendowym odbiciem DTO z backendu.
 * Rekrutacyjnie: trzymanie kontraktu jawnie typowanego ogranicza liczbę bugów
 * "backend oczekiwał innego JSON-a".
 */
export interface CsvColumnMapping {
  action: 'existing' | 'new' | 'skip'
  accountId?: string
  name?: string
  bucket?: AccountBucket
  currency?: string
}

export interface CsvImportMapping {
  year: number
  columns: Record<string, CsvColumnMapping>
}

export interface ImportedAccountSummary {
  accountId: string
  name: string
  snapshotsImported: number
}

export interface ImportWarning {
  code: string
  message: string
  accountId?: string
  proposedClosedAt?: string
}

export interface CsvImportResult {
  status: 'success' | 'partial_with_warnings'
  accounts: ImportedAccountSummary[]
  warnings: ImportWarning[]
  snapshotsImported: number
}

/*
 * Centralne składanie URL.
 * Komponenty nigdy nie powinny wiedzieć, czy endpoint to /api/accounts
 * czy http://localhost:8080/api/accounts. To szczegół infrastruktury.
 */
const apiUrl = (path: string) => `${API_BASE_URL.replace(/\/$/, '')}/api${path}`

/*
 * fetch nie rzuca wyjątku dla HTTP 400/500. Rzuca tylko dla problemów sieciowych.
 * Dlatego po każdym request sprawdzamy response.ok i sami tworzymy ApiError.
 *
 * Angular porównanie:
 * HttpClient automatycznie kieruje non-2xx do error channel Observable.
 * fetch jest niższopoziomowy, więc adapter aplikacyjny jest bardzo przydatny.
 */
async function parseError(response: Response): Promise<ApiError> {
  const text = await response.text()
  if (!text) return new ApiError(response.status, response.statusText)

  try {
    const details = JSON.parse(text)
    const message = typeof details.message === 'string' ? details.message : response.statusText
    return new ApiError(response.status, message, details)
  } catch {
    return new ApiError(response.status, text)
  }
}

/*
 * request<T> to generyczny helper.
 *
 * T mówi TypeScriptowi, jakiego kształtu JSON spodziewamy się z backendu:
 *   const accounts = await request<Account[]>('/accounts')
 *
 * To nie waliduje runtime. TypeScript znika w przeglądarce. Jeśli backend
 * zwróci zły JSON, typy pomogły tylko na etapie kodowania. Runtime validation
 * wymagałaby np. Zod/io-ts.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  /*
   * Backend EPIC-3 wymaga X-Api-Token na każdym /api/**.
   * Centralizacja tego nagłówka zapobiega bugom typu "jeden endpoint zapomniał tokena".
   */
  headers.set('X-Api-Token', API_TOKEN)

  /*
   * FormData sam ustawia Content-Type z boundary multipart.
   * Jeśli ustawisz go ręcznie, upload pliku często się psuje.
   */
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(apiUrl(path), { ...options, headers })
  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T

  const text = await response.text()
  return text ? JSON.parse(text) as T : undefined as T
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body: RequestBody) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })
const put = <T>(path: string, body: RequestBody) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
const del = (path: string) => request<void>(path, { method: 'DELETE' })

/*
 * Singletony backendu:
 * - GET /settings może zwrócić 404, gdy jeszcze nie ustawiono settings.
 * - To nie jest błąd UX; aplikacja może wtedy użyć defaultSettings i PUT.
 */
async function getOptional<T>(path: string): Promise<T | undefined> {
  try {
    return await get<T>(path)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined
    throw error
  }
}

/*
 * Poniższe obiekty to małe "repositories" HTTP.
 *
 * Angular porównanie:
 * To jest podobne do serwisów Angulara:
 *   accounts.service.ts -> list/create/update/delete
 * Różnica: tutaj nie ma DI container. Po prostu eksportujemy obiekt/funkcje.
 */
export const accountsApi = {
  list: () => get<Account[]>('/accounts'),
  create: (account: Omit<Account, 'id'> & { id?: string }) => post<Account>('/accounts', account),
  update: (id: string, account: Account) => put<Account>(`/accounts/${id}`, account),
  remove: (id: string) => del(`/accounts/${id}`),
}

export const snapshotsApi = {
  history: (accountId: string) => get<AccountSnapshot[]>(`/accounts/${accountId}/snapshots`),
  upsert: (accountId: string, snapshot: AccountSnapshot) =>
    put<AccountSnapshot>(`/accounts/${accountId}/snapshots/${snapshot.yearMonth}`, snapshot),
  remove: (accountId: string, yearMonth: string) => del(`/accounts/${accountId}/snapshots/${yearMonth}`),
}

export const categoriesApi = {
  list: () => get<Category[]>('/categories'),
  create: (category: Omit<Category, 'id'> & { id?: number }) => post<Category>('/categories', category),
  update: (id: number, category: Category) => put<Category>(`/categories/${id}`, category),
  remove: (id: number) => del(`/categories/${id}`),
}

export const categoryRulesApi = {
  list: () => get<CategoryRule[]>('/category-rules'),
  create: (rule: Omit<CategoryRule, 'id'> & { id?: number }) => post<CategoryRule>('/category-rules', rule),
  update: (id: number, rule: CategoryRule) => put<CategoryRule>(`/category-rules/${id}`, rule),
  remove: (id: number) => del(`/category-rules/${id}`),
}

export const transactionsApi = {
  list: (options: { accountId?: string; onlyUncategorized?: boolean; limit?: number } = {}) => {
    const params = new URLSearchParams()
    if (options.accountId) params.set('accountId', options.accountId)
    if (options.onlyUncategorized) params.set('onlyUncategorized', 'true')
    if (options.limit) params.set('limit', String(options.limit))
    const query = params.toString()
    return get<BankTransaction[]>(`/transactions${query ? `?${query}` : ''}`)
  },
  overrideCategory: (id: number, categoryId: number | undefined, locked = true) =>
    put<void>(`/transactions/${id}/category`, { categoryId: categoryId ?? null, locked }),
}

export const recategorizeApi = {
  run: (accountId?: string) => post<RecategorizeResult>('/recategorize', accountId ? { accountId } : {}),
}

export const incomeAnchorsApi = {
  list: () => get<IncomeAnchor[]>('/income-anchors'),
  candidates: (limit = 25) => get<IncomeAnchorCandidate[]>(`/income-anchors/candidates?limit=${limit}`),
  create: (anchor: { accountId: string; counterparty: string }) => post<IncomeAnchor>('/income-anchors', anchor),
  remove: (id: number) => del(`/income-anchors/${id}`),
}

export const payPeriodsApi = {
  list: (options: { accountId?: string; limit?: number } = {}) => {
    const params = new URLSearchParams()
    if (options.accountId) params.set('accountId', options.accountId)
    if (options.limit) params.set('limit', String(options.limit))
    const query = params.toString()
    return get<PayPeriod[]>(`/pay-periods${query ? `?${query}` : ''}`)
  },
  refresh: () => post<PayPeriodRefreshResult>('/pay-periods/refresh', {}),
  settings: () => get<PayPeriodSettings>('/pay-periods/settings'),
  updateSettings: (settings: PayPeriodSettings) => put<PayPeriodSettings>('/pay-periods/settings', settings),
}

export const loansApi = {
  list: () => get<Loan[]>('/debts'),
  create: (loan: Omit<Loan, 'id'> & { id?: string }) => post<Loan>('/debts', loan),
  update: (id: string, loan: Loan) => put<Loan>(`/debts/${id}`, loan),
  remove: (id: string) => del(`/debts/${id}`),
}

export const subscriptionsApi = {
  list: () => get<Subscription[]>('/subscriptions'),
  create: (subscription: Omit<Subscription, 'id'> & { id?: string }) =>
    post<Subscription>('/subscriptions', subscription),
  update: (id: string, subscription: Subscription) => put<Subscription>(`/subscriptions/${id}`, subscription),
  remove: (id: string) => del(`/subscriptions/${id}`),
}

export const upcomingExpensesApi = {
  list: () => get<UpcomingExpense[]>('/upcoming-expenses'),
  create: (expense: Omit<UpcomingExpense, 'id'> & { id?: string }) =>
    post<UpcomingExpense>('/upcoming-expenses', expense),
  update: (id: string, expense: UpcomingExpense) => put<UpcomingExpense>(`/upcoming-expenses/${id}`, expense),
  remove: (id: string) => del(`/upcoming-expenses/${id}`),
}

export const goalsApi = {
  list: () => get<Goal[]>('/goals'),
  create: (goal: Omit<Goal, 'id'> & { id?: string }) => post<Goal>('/goals', goal),
  update: (id: string, goal: Goal) => put<Goal>(`/goals/${id}`, goal),
  remove: (id: string) => del(`/goals/${id}`),
}

export const mortgageApi = {
  get: () => getOptional<MortgagePlan>('/mortgage-plan'),
  put: (plan: MortgagePlan) => put<MortgagePlan>('/mortgage-plan', plan),
  remove: () => del('/mortgage-plan'),
}

export const settingsApi = {
  get: () => getOptional<Settings>('/settings'),
  put: (settings: Settings) => put<Settings>('/settings', settings),
}

export const overridesApi = {
  get: () => get<Overrides>('/overrides'),
  put: (overrides: Overrides) => put<Overrides>('/overrides', overrides),
}

export const importApi = {
  accountSnapshots: (file: File, mapping: CsvImportMapping) => {
    const formData = new FormData()
    formData.append('file', file)
    /*
     * Backend oczekuje multipart:
     * - file: binarny CSV,
     * - mapping: JSON part.
     *
     * Blob z application/json sprawia, że Spring może zmapować część "mapping"
     * na CsvImportMappingDto.
     */
    formData.append('mapping', new Blob([JSON.stringify(mapping)], { type: 'application/json' }))
    return request<CsvImportResult>('/import/account-snapshots', { method: 'POST', body: formData })
  },
}
