import { ArrowDown, ArrowUp } from 'lucide-react'
import type { TransactionSort, TransactionSortKey } from './transactionSorting'

export function SortableTransactionHeader({
  label,
  sortKey,
  sort,
  onSort,
  className = 'py-2 pr-3',
  align = 'left',
}: {
  label: string
  sortKey: TransactionSortKey
  sort: TransactionSort
  onSort: (key: TransactionSortKey) => void
  className?: string
  align?: 'left' | 'right'
}) {
  const active = sort.key === sortKey
  const Icon = active && sort.direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <th className={`${className} font-medium`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex w-full items-center gap-1.5 rounded-sm text-xs font-medium transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:hover:text-gray-100 ${
          align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
        } ${active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
        aria-label={`Sortuj po kolumnie ${label}`}
      >
        <span>{label}</span>
        <Icon size={13} className={active ? 'opacity-100' : 'opacity-35'} />
      </button>
    </th>
  )
}
