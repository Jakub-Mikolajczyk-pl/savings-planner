import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Lock, Repeat, Scissors, TrendingUp, Unlock, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { IS_API_MODE } from '../../config'
import { formatPLN } from '../../domain/formatting'
import type { BankTransaction, Category, CycleCategoryRollup, CycleLeakAnalysis, PayPeriod } from '../../domain/types'
import { useStore } from '../../store'
import { SortableTransactionHeader } from '../transactions/SortableTransactionHeader'
import {
  DEFAULT_TRANSACTION_SORT,
  nextTransactionSort,
  sortTransactions,
  type TransactionSort,
  type TransactionSortKey,
} from '../transactions/transactionSorting'
import { Collapsible } from '../ui/Collapsible'

interface Props {
  selectedPeriod?: PayPeriod
}

export function LeakAnalysisSection({ selectedPeriod }: Props) {
  const leakAnalysis = useStore(s => s.leakAnalysis)
  const cycleTransactions = useStore(s => s.cycleTransactions)
  const cycleTransactionsPeriod = useStore(s => s.cycleTransactionsPeriod)
  const categories = useStore(s => s.categories)
  const loadLeakAnalysis = useStore(s => s.loadLeakAnalysis)
  const loadCycleTransactions = useStore(s => s.loadCycleTransactions)
  const overrideTransactionCategory = useStore(s => s.overrideTransactionCategory)
  const [selectedCategory, setSelectedCategory] = useState<CycleCategoryRollup | undefined>()

  useEffect(() => {
    if (selectedPeriod) {
      void loadLeakAnalysis(selectedPeriod.accountId, selectedPeriod.periodNo)
      void loadCycleTransactions(selectedPeriod.accountId, selectedPeriod.periodNo)
    }
  }, [loadCycleTransactions, loadLeakAnalysis, selectedPeriod])

  const cycleTransactionsLoaded = selectedPeriod !== undefined &&
    cycleTransactionsPeriod?.accountId === selectedPeriod.accountId &&
    cycleTransactionsPeriod.periodNo === selectedPeriod.periodNo
  const assignTransactionCategory = async (transactionId: number, categoryId: number | undefined, locked = true) => {
    if (!selectedPeriod) return
    await overrideTransactionCategory(transactionId, categoryId, locked)
    await Promise.all([
      loadLeakAnalysis(selectedPeriod.accountId, selectedPeriod.periodNo),
      loadCycleTransactions(selectedPeriod.accountId, selectedPeriod.periodNo),
    ])
  }
  const activeCategory = selectedCategory
    ? leakAnalysis?.topCategories.find(row => row.categoryId === selectedCategory.categoryId && row.categoryName === selectedCategory.categoryName) ?? selectedCategory
    : undefined

  if (!IS_API_MODE) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Analiza wycieku jest dostępna w trybie API.
      </div>
    )
  }

  if (!selectedPeriod) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Wybierz albo utwórz cykl budżetowy, żeby zobaczyć gdzie ucieka gotówka.
      </div>
    )
  }

  if (!leakAnalysis || leakAnalysis.accountId !== selectedPeriod.accountId || leakAnalysis.periodNo !== selectedPeriod.periodNo) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">Ładuję analizę cyklu...</div>
  }

  return (
    <div className="space-y-4">
      <CycleSummary analysis={leakAnalysis} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <TopCategories analysis={leakAnalysis} onSelectCategory={setSelectedCategory} />
        <RecurringList analysis={leakAnalysis} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MicroExpenses analysis={leakAnalysis} />
        <DeltaHighlights analysis={leakAnalysis} />
      </div>

      <CycleTransactionsReview
        transactions={cycleTransactionsLoaded ? cycleTransactions ?? [] : undefined}
        categories={categories}
        onAssignCategory={assignTransactionCategory}
      />

      {activeCategory && (
        <CategoryTransactionsOverlay
          category={activeCategory}
          transactions={cycleTransactionsLoaded ? filterTransactionsForCategory(cycleTransactions ?? [], activeCategory) : undefined}
          categories={categories}
          onAssignCategory={assignTransactionCategory}
          onClose={() => setSelectedCategory(undefined)}
        />
      )}
    </div>
  )
}

function CycleSummary({ analysis }: { analysis: CycleLeakAnalysis }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      <Metric label="Wpływ" value={formatPLN(analysis.income)} tone="positive" />
      <Metric label="Wydatek" value={formatPLN(analysis.expense)} tone="negative" />
      <Metric label="Netto" value={formatPLN(analysis.net)} tone={analysis.net < 0 ? 'negative' : 'positive'} />
      <Metric label="Zakres" value={`${analysis.periodStart} - ${analysis.periodEnd ?? 'teraz'}`} detail={analysis.isPartial ? 'Cykl częściowy' : undefined} />
    </div>
  )
}

function TopCategories({
  analysis,
  onSelectCategory,
}: {
  analysis: CycleLeakAnalysis
  onSelectCategory: (category: CycleCategoryRollup) => void
}) {
  const rows = analysis.topCategories
    .filter(row => row.expense > 0 || row.income > 0 || savingsContribution(row) > 0 || savingsWithdrawal(row) > 0)
    .slice(0, 8)
  const maxAmount = Math.max(...rows.map(row => row.expense + row.income + savingsContribution(row) + savingsWithdrawal(row)), 1)

  return (
    <Panel title="Top kategorie" icon={TrendingUp}>
      {rows.length === 0 ? (
        <Empty text="Brak wpływów, wydatków i ruchów oszczędnościowych w tym cyklu." />
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const expensePct = (row.expense / maxAmount) * 100
            const incomePct = (row.income / maxAmount) * 100
            const contribution = savingsContribution(row)
            const withdrawal = savingsWithdrawal(row)
            const savingsContributionPct = (contribution / maxAmount) * 100
            const savingsWithdrawalPct = (withdrawal / maxAmount) * 100

            return (
              <button
                key={`${row.categoryId ?? 'none'}-${row.categoryName}`}
                type="button"
                onClick={() => onSelectCategory(row)}
                className="block w-full space-y-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:hover:bg-gray-900"
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-gray-900 dark:text-gray-100">{row.categoryName}</span>
                  <div className="flex shrink-0 flex-wrap justify-end gap-x-2 gap-y-0.5 tabular-nums">
                    {row.expense > 0 && <Amount value={row.expense} kind="expense" />}
                    {row.income > 0 && <Amount value={row.income} kind="income" />}
                    {contribution > 0 && <Amount value={contribution} kind="savings" />}
                    {withdrawal > 0 && <Amount value={withdrawal} kind="income" label="z oszcz." />}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800">
                  <div className="flex h-full">
                    {row.expense > 0 && <div className="h-full bg-rose-500/80" style={{ width: `${expensePct}%` }} />}
                    {row.income > 0 && <div className="h-full bg-teal-500/80" style={{ width: `${incomePct}%` }} />}
                    {contribution > 0 && <div className="h-full bg-amber-500/80" style={{ width: `${savingsContributionPct}%` }} />}
                    {withdrawal > 0 && <div className="h-full bg-sky-500/80" style={{ width: `${savingsWithdrawalPct}%` }} />}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {row.transactionCount} transakcji, net <span className={amountTone(row.amount)}>{formatPLN(row.amount)}</span>
                </p>
              </button>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function RecurringList({ analysis }: { analysis: CycleLeakAnalysis }) {
  return (
    <Panel title="Cykliczne z danych" icon={Repeat}>
      {analysis.recurring.length === 0 ? (
        <Empty text="Nie widzę jeszcze powtarzalnych obciążeń w tym cyklu." />
      ) : (
        <div className="space-y-2">
          {analysis.recurring.map(item => (
            <div key={`${item.counterparty}-${item.averageAmount}`} className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{item.counterparty}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.transactionCount} wystąpień, średnio {formatPLN(item.averageAmount)}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  {formatPLN(item.currentCycleAmount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function MicroExpenses({ analysis }: { analysis: CycleLeakAnalysis }) {
  const total = useMemo(
    () => analysis.microExpenses.reduce((sum, row) => sum + row.expense, 0),
    [analysis.microExpenses],
  )

  return (
    <Panel title="Śmierć od tysiąca cięć" icon={Scissors} badge={formatPLN(total)}>
      {analysis.microExpenses.length === 0 ? (
        <Empty text="Brak mikro-wydatków poniżej 50 zł." />
      ) : (
        <div className="space-y-2">
          {analysis.microExpenses.map(row => (
            <ListRow
              key={`${row.categoryId ?? 'none'}-${row.categoryName}`}
              label={row.categoryName}
              detail={`${row.transactionCount} transakcji poniżej 50 zł`}
              value={formatPLN(row.expense)}
              tone="expense"
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

function DeltaHighlights({ analysis }: { analysis: CycleLeakAnalysis }) {
  return (
    <Panel title="Największe wzrosty" icon={AlertTriangle}>
      {analysis.deltas.length === 0 ? (
        <Empty text="Brak dodatnich odchyleń względem trzech poprzednich pełnych cykli." />
      ) : (
        <div className="space-y-2">
          {analysis.deltas.slice(0, 6).map(row => (
            <ListRow
              key={`${row.categoryId ?? 'none'}-${row.categoryName}`}
              label={row.categoryName}
              detail={`Średnia ${formatPLN(row.baselineAverage)}${row.increasePct ? `, +${row.increasePct}%` : ''}`}
              value={`+${formatPLN(row.increase)}`}
              tone={isIncomeLikeCategory(row.categoryName) ? 'income' : 'expense'}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

function Panel({ title, icon: Icon, badge, children }: { title: string; icon: LucideIcon; badge?: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
        {badge && <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{badge}</span>}
      </div>
      {children}
    </div>
  )
}

function Metric({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail?: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  const toneClass = tone === 'positive'
    ? 'text-teal-700 dark:text-teal-300'
    : tone === 'negative'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-gray-900 dark:text-gray-100'

  return (
    <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>}
    </div>
  )
}

function ListRow({ label, detail, value, tone = 'expense' }: { label: string; detail: string; value: string; tone?: AmountKind }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{detail}</p>
      </div>
      <span className={`whitespace-nowrap text-sm font-semibold tabular-nums ${amountToneByKind(tone)}`}>{value}</span>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">{text}</p>
}

function CycleTransactionsReview({
  transactions,
  categories,
  onAssignCategory,
}: {
  transactions?: BankTransaction[]
  categories: Category[]
  onAssignCategory: (transactionId: number, categoryId: number | undefined, locked?: boolean) => Promise<void>
}) {
  const [transactionSort, setTransactionSort] = useState<TransactionSort>(DEFAULT_TRANSACTION_SORT)
  const categoryById = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories],
  )
  const sortedTransactions = useMemo(
    () => transactions ? sortTransactions(transactions, categories, transactionSort) : undefined,
    [categories, transactionSort, transactions],
  )
  const sortByTransactionColumn = (key: TransactionSortKey) => {
    setTransactionSort(current => nextTransactionSort(current, key))
  }

  return (
    <Collapsible title="Transakcje w cyklu" badge={sortedTransactions ? String(sortedTransactions.length) : '...'}>
      {sortedTransactions === undefined ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Ładuję transakcje cyklu...</p>
      ) : sortedTransactions.length === 0 ? (
        <Empty text="Brak transakcji w tym cyklu." />
      ) : (
        <TransactionsTable
          transactions={sortedTransactions}
          categories={categories}
          categoryById={categoryById}
          onAssignCategory={onAssignCategory}
          sort={transactionSort}
          onSort={sortByTransactionColumn}
        />
      )}
    </Collapsible>
  )
}

function CategoryTransactionsOverlay({
  category,
  transactions,
  categories,
  onAssignCategory,
  onClose,
}: {
  category: CycleCategoryRollup
  transactions?: BankTransaction[]
  categories: Category[]
  onAssignCategory: (transactionId: number, categoryId: number | undefined, locked?: boolean) => Promise<void>
  onClose: () => void
}) {
  const [transactionSort, setTransactionSort] = useState<TransactionSort>(DEFAULT_TRANSACTION_SORT)
  const categoryById = useMemo(
    () => new Map(categories.map(item => [item.id, item])),
    [categories],
  )
  const sortedTransactions = useMemo(
    () => transactions ? sortTransactions(transactions, categories, transactionSort) : undefined,
    [categories, transactionSort, transactions],
  )
  const sortByTransactionColumn = (key: TransactionSortKey) => {
    setTransactionSort(current => nextTransactionSort(current, key))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/60 px-3 py-0 sm:items-center sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Szczegóły kategorii ${category.categoryName}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-950 sm:max-h-[85vh] sm:rounded-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{category.categoryName}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {category.transactionCount} transakcji, net <span className={amountTone(category.amount)}>{formatPLN(category.amount)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 overflow-auto p-4">
          {sortedTransactions === undefined ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ładuję transakcje kategorii...</p>
          ) : sortedTransactions.length === 0 ? (
            <Empty text="Brak transakcji dla tej kategorii w cyklu." />
          ) : (
            <TransactionsTable
              transactions={sortedTransactions}
              categories={categories}
              categoryById={categoryById}
              onAssignCategory={onAssignCategory}
              sort={transactionSort}
              onSort={sortByTransactionColumn}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function TransactionsTable({
  transactions,
  categories,
  categoryById,
  onAssignCategory,
  sort,
  onSort,
}: {
  transactions: BankTransaction[]
  categories: Category[]
  categoryById: Map<number, Category>
  onAssignCategory: (transactionId: number, categoryId: number | undefined, locked?: boolean) => Promise<void>
  sort: TransactionSort
  onSort: (key: TransactionSortKey) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs text-gray-500 dark:text-gray-400">
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <SortableTransactionHeader label="Data" sortKey="bookedAt" sort={sort} onSort={onSort} />
            <SortableTransactionHeader label="Opis" sortKey="description" sort={sort} onSort={onSort} />
            <SortableTransactionHeader label="Kwota" sortKey="amount" sort={sort} onSort={onSort} align="right" />
            <SortableTransactionHeader label="Kategoria" sortKey="category" sort={sort} onSort={onSort} />
            <SortableTransactionHeader label="Blokada" sortKey="categoryLocked" sort={sort} onSort={onSort} className="py-2 pr-0" />
          </tr>
        </thead>
        <tbody>
          {transactions.map(transaction => {
            const categoryName = transaction.categoryId
              ? categoryById.get(transaction.categoryId)?.name
              : undefined

            return (
              <tr key={transaction.id} className="border-b border-gray-100 align-top dark:border-gray-900">
                <td className="whitespace-nowrap py-2 pr-3 text-gray-500 dark:text-gray-400">{transaction.bookedAt}</td>
                <td className="min-w-72 py-2 pr-3">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{transaction.counterparty ?? transaction.description}</p>
                  <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{transaction.description}</p>
                </td>
                <td className={`whitespace-nowrap py-2 pr-3 text-right tabular-nums ${transaction.amount < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-teal-700 dark:text-teal-300'}`}>
                  {formatPLN(transaction.amount)}
                </td>
                <td className="py-2 pr-3">
                  <select
                    value={transaction.categoryId ?? ''}
                    onChange={event => void onAssignCategory(transaction.id, event.target.value ? Number(event.target.value) : undefined, true)}
                    className="w-full min-w-44 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-800 dark:bg-gray-950"
                    aria-label={`Kategoria transakcji ${transaction.description}`}
                  >
                    <option value="">Bez kategorii</option>
                    {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  {categoryName && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{categoryName}</p>}
                </td>
                <td className="whitespace-nowrap py-2 pr-0">
                  <button
                    type="button"
                    onClick={() => void onAssignCategory(transaction.id, transaction.categoryId, !transaction.categoryLocked)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {transaction.categoryLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    {transaction.categoryLocked ? 'Ręczna' : 'Reguły'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function filterTransactionsForCategory(transactions: BankTransaction[], category: CycleCategoryRollup) {
  return transactions.filter(transaction => {
    if (category.categoryId == null) return transaction.categoryId == null
    return transaction.categoryId === category.categoryId
  })
}

type AmountKind = 'income' | 'expense' | 'savings' | 'neutral'

function Amount({ value, kind, label }: { value: number; kind: AmountKind; label?: string }) {
  const prefix = kind === 'income' ? '+' : kind === 'expense' || kind === 'savings' ? '-' : ''

  return <span className={`whitespace-nowrap font-semibold ${amountToneByKind(kind)}`}>{label ? `${label} ` : ''}{prefix}{formatPLN(value)}</span>
}

function amountTone(amount: number) {
  if (amount > 0) return amountToneByKind('income')
  if (amount < 0) return amountToneByKind('expense')
  return amountToneByKind('neutral')
}

function amountToneByKind(kind: AmountKind) {
  if (kind === 'income') return 'text-teal-700 dark:text-teal-300'
  if (kind === 'expense') return 'text-rose-600 dark:text-rose-400'
  if (kind === 'savings') return 'text-amber-700 dark:text-amber-300'
  return 'text-gray-900 dark:text-gray-100'
}

function isIncomeLikeCategory(categoryName: string) {
  return categoryName.trim().toLowerCase().startsWith('przych')
}

function savingsContribution(row: { savingsContribution?: number }) {
  return row.savingsContribution ?? 0
}

function savingsWithdrawal(row: { savingsWithdrawal?: number }) {
  return row.savingsWithdrawal ?? 0
}
