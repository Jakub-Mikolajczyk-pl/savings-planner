import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Lock, Plus, RefreshCw, Trash2, Unlock } from 'lucide-react'
import { IS_API_MODE } from '../../config'
import { formatPLN } from '../../domain/formatting'
import type { CategoryKind, RuleMatchField, RuleMatchType } from '../../domain/types'
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

export function CategorizationSection() {
  const categories = useStore(s => s.categories)
  const categoryRules = useStore(s => s.categoryRules)
  const transactions = useStore(s => s.transactions)
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

  const categoryById = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories],
  )
  const selectedRuleCategoryId = ruleCategoryId ?? categories[0]?.id
  const uncategorized = transactions.filter(transaction => transaction.categoryId === undefined).length
  const visibleTransactions = transactions.slice(0, visibleTransactionCount)
  const hiddenTransactionCount = Math.max(0, transactions.length - visibleTransactions.length)

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
    setLastRun(
      `${result.categorized}/${result.total}` +
      (result.llmAttempted ? `, LLM ${result.llmAttempted}` : '') +
      (result.llmLimitReached ? ', uruchom ponownie' : ''),
    )
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
        <button
          type="button"
          onClick={runRecategorize}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <RefreshCw size={16} />
          Przelicz reguly
        </button>
      </div>

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

      <Collapsible title="Transakcje" defaultOpen badge={`${visibleTransactions.length}/${transactions.length}`}>
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
                      onChange={event => overrideTransactionCategory(transaction.id, event.target.value ? Number(event.target.value) : undefined, true)}
                      className="w-full min-w-44 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-800 dark:bg-gray-950"
                    >
                      <option value="">Bez kategorii</option>
                      {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-0">
                    <button
                      type="button"
                      onClick={() => overrideTransactionCategory(transaction.id, transaction.categoryId, !transaction.categoryLocked)}
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
