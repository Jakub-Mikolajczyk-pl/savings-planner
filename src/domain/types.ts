export interface Loan {
  id: string
  name: string
  remainingBalance: number  // current outstanding balance
  monthlyPayment: number    // minimum monthly payment
}

export interface LoanMonthEntry {
  loanId: string
  payment: number       // actual payment this month
  balanceAfter: number
  isPaidOff: boolean
}

export interface LoanProgress {
  loanId: string
  name: string
  initialBalance: number
  monthlyPayment: number
  payoffMonth?: string          // "YYYY-MM" within horizon
  projectedPayoffMonth?: string // beyond horizon
}

export type BillingPeriod = 'monthly' | 'yearly'

export interface Subscription {
  id: string
  name: string
  monthlyAmount: number // efektywny koszt MIESIĘCZNY usera (po normalizacji okresu i podziale) — źródło cashflow
  active: boolean
  category?: string
  nextCharge?: string // "YYYY-MM-DD", opcjonalne pod alerty
  billingPeriod?: BillingPeriod // jak naliczane; brak => 'monthly' (legacy)
  billingAmount?: number // pełna kwota za okres rozliczeniowy, przed podziałem; brak => monthlyAmount (legacy)
  shared?: boolean // abonament rodzinny / współdzielony — składam się z innymi
  shareCount?: number // liczba osób się składających (z userem); efektywny = billingAmount/okres / shareCount
}

export interface UpcomingExpense {
  id: string
  name: string
  amount: number
  targetMonth: string // "YYYY-MM"
  isPaid: boolean
}

// Assets: konta i ich stany w czasie (snapshoty)
export type AccountBucket =
  | 'accounts'
  | 'safety_cushion'
  | 'retirement'
  | 'renovation'
  | 'investments'
  | 'vacation'
  | 'emergency_fund'

export interface Account {
  id: string
  name: string
  bucket: AccountBucket
  currency: string
  openedAt?: string // "YYYY-MM" - miesiac pierwszego snapshota
  closedAt?: string // "YYYY-MM" - undefined = aktywne; po tej dacie saldo = 0
}

export interface AccountSnapshot {
  accountId: string
  yearMonth: string // "YYYY-MM"
  balance: number
  notes?: string
}

export type CategoryKind = 'variable' | 'fixed' | 'recurring'
export type CashflowTreatment = 'expense' | 'income' | 'internal_transfer' | 'savings'
export type RuleMatchField = 'description' | 'counterparty'
export type RuleMatchType = 'contains' | 'regex'
export type CategoryRuleSource = 'manual' | 'seed' | 'llm'

export interface Category {
  id: number
  name: string
  kind: CategoryKind
  cashflowTreatment: CashflowTreatment
  parentId?: number
}

export interface CategoryRule {
  id: number
  matchField: RuleMatchField
  matchType: RuleMatchType
  pattern: string
  categoryId: number
  priority: number
  source: CategoryRuleSource
}

export interface BankTransaction {
  id: number
  accountId: string
  bookedAt: string // "YYYY-MM-DD"
  amount: number
  currency: string
  description: string
  counterparty?: string
  source: string
  categoryId?: number
  categoryLocked: boolean
}

export interface RecategorizeResult {
  categorized: number
  total: number
  changed?: number
  newlyCategorized?: number
  deterministicMatched?: number
  llmAttempted?: number
  llmCategorized?: number
  llmNoSuggestion?: number
  llmLowConfidence?: number
  llmParseErrors?: number
  llmTransportErrors?: number
  llmCategoryMismatch?: number
  llmLastTransactionId?: number
  remainingUncategorized?: number
  llmLimitReached?: boolean
}

export interface IncomeAnchor {
  id: number
  accountId: string
  accountName: string
  counterparty: string
  createdAt: string
}

export interface IncomeAnchorCandidate {
  accountId: string
  accountName: string
  counterparty: string
  transactionCount: number
  firstBookedAt: string
  lastBookedAt: string
  totalIncome: number
  alreadyAnchored: boolean
}

export interface PayPeriodSettings {
  minCycleDays: number
}

export interface PayPeriod {
  periodNo: number
  accountId: string
  accountName: string
  periodStart: string
  periodEnd?: string
  anchorTxId: number
  isPartial: boolean
  income: number
  expense: number
  net: number
}

export interface PayPeriodRefreshResult {
  periods: number
}

export type BankSource = 'ALIOR_CSV' | 'VELO_PDF'

export interface IngestResult {
  inserted: number
  skipped: number
  bank: BankSource
  accountId: string
}

export interface CycleCategoryRollup {
  categoryId?: number
  categoryName: string
  categoryKind?: CategoryKind
  cashflowTreatment: CashflowTreatment
  amount: number
  income: number
  expense: number
  savingsContribution: number
  savingsWithdrawal: number
  transactionCount: number
}

export interface RecurringLeak {
  counterparty: string
  categoryId?: number
  categoryName?: string
  categoryKind?: CategoryKind
  transactionCount: number
  averageAmount: number
  currentCycleAmount: number
  firstBookedAt: string
  lastBookedAt: string
}

export interface MicroExpenseRollup {
  categoryId?: number
  categoryName: string
  categoryKind?: CategoryKind
  expense: number
  transactionCount: number
}

export interface CycleDelta {
  categoryId?: number
  categoryName: string
  categoryKind?: CategoryKind
  currentExpense: number
  baselineAverage: number
  increase: number
  increasePct?: number
}

export interface CycleLeakAnalysis {
  periodNo: number
  accountId: string
  accountName: string
  periodStart: string
  periodEnd?: string
  isPartial: boolean
  income: number
  expense: number
  net: number
  topCategories: CycleCategoryRollup[]
  recurring: RecurringLeak[]
  microExpenses: MicroExpenseRollup[]
  deltas: CycleDelta[]
}

export interface FreeCashCycle {
  periodNo: number
  accountId: string
  accountName: string
  periodStart: string
  periodEnd?: string
  isPartial: boolean
  income: number
  fixedExpense: number
  recurringExpense: number
  committedExpense: number
  variableExpense: number
  uncategorizedExpense: number
  totalExpense: number
  savingsContribution: number
  savingsWithdrawal: number
  net: number
  freeCash: number
}

export type GoalPaceStatus = 'complete' | 'no_history' | 'unreachable' | 'behind_plan' | 'on_track'

export interface GoalPace {
  goalId: string
  name: string
  targetAmount: number
  currentSaved: number
  remainingAmount: number
  priority: number
  fixedAllocation?: number
  plannedPerCycle?: number
  actualPerCycle: number
  projectedCycles?: number
  status: GoalPaceStatus
}

export interface GoalInsights {
  currentCycle?: FreeCashCycle
  recentCycles: FreeCashCycle[]
  cycleCount: number
  averageNetPerCycle: number
  averageFreeCashPerCycle: number
  goals: GoalPace[]
}

export type MortgageOverpaymentMode = 'shortenTerm' | 'reducePayment'

export interface MortgageOneTimeOverpayment {
  id: string
  yearMonth: string // "YYYY-MM"
  amount: number
}

export interface MortgagePlan {
  id: string
  name: string
  principal: number
  annualInterestRate: number // percent, e.g. 7.2
  originalTermMonths: number
  termMonths: number // remaining months
  monthlyOverpayment: number
  overpaymentMode: MortgageOverpaymentMode
  oneTimeOverpayments: MortgageOneTimeOverpayment[]
  refinanceAnnualInterestRate?: number
  refinanceCost?: number
}

export interface MortgageMonthEntry {
  yearMonth: string
  payment: number
  interest: number
  principalPaid: number
  overpayment: number
  balanceAfter: number
  cumulativeInterest: number
  isPaidOff: boolean
}

export interface MortgageSummary {
  name: string
  baseMonthlyPayment: number
  currentMonthlyPayment: number
  elapsedMonths: number
  estimatedStartMonth: string
  payoffMonth?: string
  remainingMonths: number
  originalTermMonths: number
  monthsSaved: number
  interestSaved: number
  totalInterest: number
  baseTotalInterest: number
  refinance?: MortgageRefinanceSummary
}

export interface MortgageRefinanceSummary {
  annualInterestRate: number
  monthlyPayment: number
  monthlyPaymentDelta: number
  totalInterest: number
  interestSaved: number
  netSavings: number
  refinanceCost: number
  payoffMonth?: string
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  deadline?: string // ISO date string "YYYY-MM-DD"
  priority: number  // lower = higher priority (1 is first)
  fixedAllocation?: number // fixed PLN/month regardless of priority calc
  currentSaved?: number // already saved before tracking started
}

export type IkzeParticipantRole = 'employee' | 'entrepreneur'
export type IkzePlanStatus = 'missing_limit' | 'in_progress' | 'complete' | 'over_limit'

export interface IkzePlanEntry {
  id: string
  year: number
  ownerName: string
  role: IkzeParticipantRole
  annualLimit: number
  contributedAmount: number
  payoutsLeft: number
}

export interface Settings {
  monthlyIncome: number
  monthlyExpenses: number
  startMonth: string // "YYYY-MM" format
  horizonMonths: number
  emergencyFundBuckets: AccountBucket[]
  safetyCushionMonths?: number  // cel poduszki = tyle miesięcy kosztów (domyślnie 6)
  emergencyFundTarget?: number  // cel funduszu awaryjnego — stała kwota (domyślnie 10000)
  ikzePlans?: IkzePlanEntry[]
  includeIkzeContributionsInCashflow?: boolean
}

export interface MonthOverride {
  income?: number
  expenses?: number
  perGoalAllocation?: Record<string, number> // goalId → manual allocation
}

export interface Overrides {
  [yearMonth: string]: MonthOverride // key: "YYYY-MM"
}

export interface MonthRow {
  yearMonth: string
  label: string
  income: number
  expenses: number
  subscriptionsTotal: number
  oneTimeExpensesTotal: number
  loanPaymentsTotal: number
  mortgagePaymentTotal: number
  ikzeContributionTotal: number
  freeCash: number
  goalAllocations: GoalAllocation[]
  loanEntries: LoanMonthEntry[]
  mortgageEntry?: MortgageMonthEntry
  isDeficit: boolean
}

export interface GoalAllocation {
  goalId: string
  allocated: number
  balanceAfter: number
  isComplete: boolean
  isManualOverride: boolean
}

export interface GoalProgress {
  goalId: string
  name: string
  targetAmount: number
  currentBalance: number
  completionMonth?: string   // within horizon
  projectedETA?: string      // computed if not within horizon
  isComplete: boolean
  deadline?: string          // "YYYY-MM" of the goal's deadline
  deadlineMissed: boolean    // true if completion is after deadline (or won't complete before deadline)
  deadlineOnTime: boolean    // true if deadline exists and will be met
  shortfallPerMonth?: number
}

export interface Schedule {
  rows: MonthRow[]
  goalProgress: GoalProgress[]
  loanProgress: LoanProgress[]
  mortgageSummary?: MortgageSummary
}
