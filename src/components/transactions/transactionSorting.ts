import type { BankTransaction, Category } from '../../domain/types'

export type TransactionSortKey = 'bookedAt' | 'description' | 'amount' | 'category' | 'categoryLocked'
export type TransactionSortDirection = 'asc' | 'desc'

export interface TransactionSort {
  key: TransactionSortKey
  direction: TransactionSortDirection
}

export const DEFAULT_TRANSACTION_SORT: TransactionSort = {
  key: 'bookedAt',
  direction: 'desc',
}

export function nextTransactionSort(current: TransactionSort, key: TransactionSortKey): TransactionSort {
  if (current.key !== key) return { key, direction: key === 'bookedAt' ? 'desc' : 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

export function sortTransactions(
  transactions: BankTransaction[],
  categories: Category[],
  sort: TransactionSort,
) {
  const categoryById = new Map(categories.map(category => [category.id, category.name]))

  return [...transactions]
    .map((transaction, index) => ({ transaction, index }))
    .sort((left, right) => {
      const direction = sort.direction === 'asc' ? 1 : -1
      const compared = compareTransactions(left.transaction, right.transaction, categoryById, sort.key)
      return compared === 0 ? left.index - right.index : compared * direction
    })
    .map(row => row.transaction)
}

function compareTransactions(
  left: BankTransaction,
  right: BankTransaction,
  categoryById: Map<number, string>,
  key: TransactionSortKey,
) {
  if (key === 'bookedAt') return compareText(left.bookedAt, right.bookedAt)
  if (key === 'description') return compareText(transactionLabel(left), transactionLabel(right))
  if (key === 'amount') return left.amount - right.amount
  if (key === 'category') return compareText(categoryLabel(left, categoryById), categoryLabel(right, categoryById))
  return Number(left.categoryLocked) - Number(right.categoryLocked)
}

function transactionLabel(transaction: BankTransaction) {
  return `${transaction.counterparty ?? ''} ${transaction.description}`.trim()
}

function categoryLabel(transaction: BankTransaction, categoryById: Map<number, string>) {
  return transaction.categoryId ? categoryById.get(transaction.categoryId) ?? '' : 'Bez kategorii'
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, 'pl', { sensitivity: 'base', numeric: true })
}
