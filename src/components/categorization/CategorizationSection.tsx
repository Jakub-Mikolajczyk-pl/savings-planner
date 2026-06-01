import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Lock, Plus, RefreshCw, Trash2, Unlock } from 'lucide-react'
import { IS_API_MODE } from '../../config'
import { formatPLN } from '../../domain/formatting'
import type { CategoryKind, RecategorizeResult, RuleMatchField, RuleMatchType } from '../../domain/types'
import { useStore } from '../../store'
import { Collapsible } from '../ui/Collapsible'

const KIND_LABELS: Record<CategoryKind, string> = {
  variable: 'Zmienne',
  fixed: 'Stale',
  recurring: 'Cykliczne',
}

const FIELD_LABELS: Record<RuleMatchField, string> = {
  description: 'Opis',
  counterparty: 'Kontrahent',
}

const TYPE_LABELS: Record<RuleMatchType, string> = {
  contains: 'Zawiera',
  regex: 'Regex',
}

const TRANSACTION_PAGE_SIZE = 50
const MAX_LLM_QUEUE_BATCHES = 500

interface LlmQueueStatus {
  running: boolean
  batches: number
  changed: number
  newlyCategorized: number
  llmAttempted: number
  llmCategorized: number
  llmNoSuggestion: number
  initialUncategorized?: number
  remainingUncategorized?: number
  message?: string
}

const emptyQueueStatus = (): LlmQueueStatus => ({
  running: true,
  batches: 0,
  changed: 0,
  newlyCategorized: 0,
  llmAttempted: 0,
  llmCategorized: 0,
  llmNoSuggestion: 0,
})

const resultSummary = (result: RecategorizeResult) =>
  `zmieniono ${result.changed ?? 0}, nowe ${result.newlyCategorized ?? 0}, ` +
  `LLM ${result.llmCategorized ?? 0}/${result.llmAttempted ?? 0}` +
  (result.llmNoSuggestion ? `, bez werdyktu ${result.llmNoSuggestion}` : '') +
  (result.remainingUncategorized !== undefined ? `, bez kategorii ${result.remainingUncategorized}` : '')

export function CategorizationSection() {
  const categories = useStore(s => s.categories)
  const categoryRules = useStore(s => s.categoryRules)
  const transactions = useStore(s => s.transactions)
  const loadCategorization = useStore(s => s.loadCategorization)
  const addCategory = useStore(s => s.addCategory)
  const removeCategory = useStore(s => s.removeCategory)
  const addCategoryRule = useStore(s => s.addCategoryRule)
  const removeCategoryRule = useStore(s => s.removeCategoryRule)
  const overrideTransactionCategory = useStore(s => s.overrideTransactionCategory)
  const recategorizeTransactions = useStore(s => s.recategorizeTransactions)
  const [categoryName, setCategoryName] = useState('')
  const [categoryKind, setCategoryKind] = useState<CategoryKind>('variable')
  const [matchField, setMatchField] = useState<RuleMatchField>('counterparty')
  const [matchType, setMatchType] = useState<RuleMatchType>('contains')
  const [pattern, setPattern] = useState('')
  const [ruleCategoryId, setRuleCategoryId] = useState<number | undefined>(undefined)
  const [priority, setPriority] = useState(100)
  const [lastRun, setLastRun] = useState<string | undefined>()
  const [visibleTransactionCount, setVisibleTransactionCount] = useState(TRANSACTION_PAGE_SIZE)
  const [onlyUncategorized, setOnlyUncategorized] = useState(false)
  const [llmQueueStatus, setLlmQueueStatus] = useState<LlmQueueStatus | undefined>()

  const categoryById = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories],
  )
  const selectedRuleCategoryId = ruleCategoryId ?? categories[0]?.id
  const uncategorized = transactions.filter(transaction => transaction.categoryId === undefined).length
  const filteredTransactions = onlyUncategorized
    ? transactions.filter(transaction => transaction.categoryId === undefined)
    : transactions
  const visibleTransactions = filteredTransactions.slice(0, visibleTransactionCount)
  const hiddenTransactionCount = Math.max(0, filteredTransactions.length - visibleTransactions.length)
  const queueProgress = llmQueueStatus?.initialUncategorized
    ? Math.min(
        100,
        Math.round(
          ((llmQueueStatus.initialUncategorized - (llmQueueStatus.remainingUncategorized ?? 0)) /
            llmQueueStatus.initialUncategorized) * 100,
        ),
      )
    : undefined

  const createCategory = (event: FormEvent) => {
    event.preventDefault()
    const name = categoryName.trim()
    if (!name) return
    addCategory({ name, kind: categoryKind })
    setCategoryName('')
  }

  const createRule = (event: FormEvent) => {
    event.preventDefault()
    if (!pattern.trim() || selectedRuleCategoryId === undefined) return
    addCategoryRule({
      matchField,
      matchType,
      pattern: pattern.trim(),
      categoryId: selectedRuleCategoryId,
      priority,
      source: 'manual',
    })
    setPattern('')
  }

  const runRecategorize = async () => {
    const result = await recategorizeTransactions()
    await loadCategorization(onlyUncategorized)
    setVisibleTransactionCount(TRANSACTION_PAGE_SIZE)
    setLastRun(resultSummary(result) + (result.llmLimitReached ? ', uruchom kolejke' : ''))
  }

  const runLlmQueue = async () => {
    setOnlyUncategorized(true)
    setVisibleTransactionCount(TRANSACTION_PAGE_SIZE)
    setLastRun(undefined)
    setLlmQueueStatus({ ...emptyQueueStatus(), message: 'Szukam transakcji bez kategorii...' })
    await loadCategorization(true)

    let afterTransactionId: number | undefined
    let status = emptyQueueStatus()

    for (let batchNo = 1; batchNo <= MAX_LLM_QUEUE_BATCHES; batchNo++) {
      const result = await recategorizeTransactions(undefined, afterTransactionId)
      const initialUncategorized = status.initialUncategorized ??
        Math.max(result.remainingUncategorized ?? 0, (result.remainingUncategorized ?? 0) + (result.newlyCategorized ?? 0))

      status = {
        running: true,
        batches: batchNo,
        changed: status.changed + (result.changed ?? 0),
        newlyCategorized: status.newlyCategorized + (result.newlyCategorized ?? 0),
        llmAttempted: status.llmAttempted + (result.llmAttempted ?? 0),
        llmCategorized: status.llmCategorized + (result.llmCategorized ?? 0),
        llmNoSuggestion: status.llmNoSuggestion + (result.llmNoSuggestion ?? 0),
        initialUncategorized,
        remainingUncategorized: result.remainingUncategorized,
        message: result.llmLimitReached ? 'Kolejny batch...' : 'Kolejka zakonczona.',
      }
      setLlmQueueStatus(status)
      setLastRun(
        `kolejka: batchy ${status.batches}, nowe ${status.newlyCategorized}, ` +
        `LLM ${status.llmCategorized}/${status.llmAttempted}, bez werdyktu ${status.llmNoSuggestion}`,
      )

      if (!result.llmLimitReached || !result.llmLastTransactionId || (result.llmAttempted ?? 0) === 0) break
      afterTransactionId = result.llmLastTransactionId
    }

    await loadCategorization(true)
    setVisibleTransactionCount(TRANSACTION_PAGE_SIZE)
    setLlmQueueStatus({ ...status, running: false, message: 'Kolejka zakonczona.' })
  }

  const toggleOnlyUncategorized = async () => {
    const next = !onlyUncategorized
    setOnlyUncategorized(next)
    setVisibleTransactionCount(TRANSACTION_PAGE_SIZE)
    await loadCategorization(next)
  }

  const assignTransactionCategory = (transactionId: number, categoryId: number | undefined, locked = true) => {
    overrideTransactionCategory(transactionId, categoryId, locked)
  }

  if (!IS_API_MODE) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Kategoryzacja transakcji jest dostepna w trybie API.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-gray-100">{transactions.length}</span> transakcji w widoku,
          {' '}<span className="font-medium text-gray-900 dark:text-gray-100">{uncategorized}</span> bez kategorii
          {lastRun ? ` - ostatnie przeliczenie ${lastRun}` : ''}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleOnlyUncategorized}
            className={`rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${
              onlyUncategorized
                ? 'border-gray-950 bg-gray-950 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-950'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
            aria-pressed={onlyUncategorized}
          >
            Bez kategorii
          </button>
          <button
            type="button"
            onClick={runRecategorize}
            disabled={llmQueueStatus?.running}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RefreshCw size={16} />
            Przelicz reguly
          </button>
          <button
            type="button"
            onClick={runLlmQueue}
            disabled={llmQueueStatus?.running}
            className="inline-flex items-center gap-2 rounded-md bg-gray-950 px-3 py-2 text-sm text-white transition-colors hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-200"
          >
            <RefreshCw size={16} />
            Kolejka LLM
          </button>
        </div>
      </div>

      {llmQueueStatus && (
        <div className="rounded-md border border-gray-200 px-3 py-3 text-sm dark:border-gray-800">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {llmQueueStatus.running ? 'Kategoryzacja LLM w toku' : 'Kategoryzacja LLM zakończona'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{llmQueueStatus.message}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full bg-gray-950 transition-[width] dark:bg-gray-100"
              style={{ width: `${queueProgress ?? (llmQueueStatus.running ? 35 : 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Batchy {llmQueueStatus.batches} · nowe {llmQueueStatus.newlyCategorized} · zmienione {llmQueueStatus.changed} ·
            {' '}LLM {llmQueueStatus.llmCategorized}/{llmQueueStatus.llmAttempted} · bez werdyktu {llmQueueStatus.llmNoSuggestion}
            {llmQueueStatus.remainingUncategorized !== undefined ? ` · bez kategorii ${llmQueueStatus.remainingUncategorized}` : ''}
          </p>
        </div>
      )}

      <Collapsible title="Kategorie" defaultOpen badge={String(categories.length)}>
        <form onSubmit={createCategory} className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_10rem_auto]">
          <input
            value={categoryName}
            onChange={event => setCategoryName(event.target.value)}
            placeholder="Nazwa kategorii"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:focus:ring-gray-700"
          />
          <select
            value={categoryKind}
            onChange={event => setCategoryKind(event.target.value as CategoryKind)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:focus:ring-gray-700"
          >
            {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-950 px-3 py-2 text-sm text-white dark:bg-gray-100 dark:text-gray-950">
            <Plus size={16} />
            Dodaj
          </button>
        </form>

        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {categories.map(category => (
            <div key={category.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{category.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{KIND_LABELS[category.kind]}</p>
              </div>
              <button
                type="button"
                onClick={() => removeCategory(category.id)}
                className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-red-600 dark:hover:bg-gray-800"
                aria-label={`Usun kategorie ${category.name}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Reguly" defaultOpen badge={String(categoryRules.length)}>
        <form onSubmit={createRule} className="grid gap-2 lg:grid-cols-[9rem_8rem_minmax(12rem,1fr)_12rem_7rem_auto]">
          <select value={matchField} onChange={event => setMatchField(event.target.value as RuleMatchField)} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950">
            {Object.entries(FIELD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={matchType} onChange={event => setMatchType(event.target.value as RuleMatchType)} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950">
            {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input value={pattern} onChange={event => setPattern(event.target.value)} placeholder="Wzorzec" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950" />
          <select value={selectedRuleCategoryId ?? ''} onChange={event => setRuleCategoryId(Number(event.target.value))} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950">
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <input type="number" value={priority} onChange={event => setPriority(Number(event.target.value))} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950" />
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-950 px-3 py-2 text-sm text-white dark:bg-gray-100 dark:text-gray-950">
            <Plus size={16} />
            Dodaj
          </button>
        </form>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs text-gray-500 dark:text-gray-400">
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="py-2 pr-3 font-medium">Priorytet</th>
                <th className="py-2 pr-3 font-medium">Pole</th>
                <th className="py-2 pr-3 font-medium">Typ</th>
                <th className="py-2 pr-3 font-medium">Wzorzec</th>
                <th className="py-2 pr-3 font-medium">Kategoria</th>
                <th className="py-2 pr-3 font-medium">Zrodlo</th>
                <th className="py-2 pr-0" />
              </tr>
            </thead>
            <tbody>
              {categoryRules.map(rule => (
                <tr key={rule.id} className="border-b border-gray-100 dark:border-gray-900">
                  <td className="py-2 pr-3 tabular-nums">{rule.priority}</td>
                  <td className="py-2 pr-3">{FIELD_LABELS[rule.matchField]}</td>
                  <td className="py-2 pr-3">{TYPE_LABELS[rule.matchType]}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{rule.pattern}</td>
                  <td className="py-2 pr-3">{categoryById.get(rule.categoryId)?.name ?? 'Brak'}</td>
                  <td className="py-2 pr-3">{rule.source}</td>
                  <td className="py-2 pr-0 text-right">
                    <button type="button" onClick={() => removeCategoryRule(rule.id)} className="rounded-md p-2 text-gray-400 hover:bg-gray-50 hover:text-red-600 dark:hover:bg-gray-800" aria-label="Usun regule">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Collapsible>

      <Collapsible title="Transakcje" defaultOpen badge={`${visibleTransactions.length}/${filteredTransactions.length}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs text-gray-500 dark:text-gray-400">
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="py-2 pr-3 font-medium">Data</th>
                <th className="py-2 pr-3 font-medium">Opis</th>
                <th className="py-2 pr-3 font-medium">Kwota</th>
                <th className="py-2 pr-3 font-medium">Kategoria</th>
                <th className="py-2 pr-0 font-medium">Blokada</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map(transaction => (
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
                      onChange={event => assignTransactionCategory(transaction.id, event.target.value ? Number(event.target.value) : undefined, true)}
                      className="w-full min-w-44 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-800 dark:bg-gray-950"
                    >
                      <option value="">Bez kategorii</option>
                      {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-0">
                    <button
                      type="button"
                      onClick={() => assignTransactionCategory(transaction.id, transaction.categoryId, !transaction.categoryLocked)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      {transaction.categoryLocked ? <Lock size={14} /> : <Unlock size={14} />}
                      {transaction.categoryLocked ? 'Reczna' : 'Reguly'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hiddenTransactionCount > 0 && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleTransactionCount(count => count + TRANSACTION_PAGE_SIZE)}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Pokaż kolejne {Math.min(TRANSACTION_PAGE_SIZE, hiddenTransactionCount)}
            </button>
          </div>
        )}
      </Collapsible>
    </div>
  )
}
