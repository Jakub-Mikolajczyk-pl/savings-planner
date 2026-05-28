import { useState } from 'react'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { formatPLN } from '../../domain/formatting'
import type { Subscription } from '../../domain/types'
import { useStore } from '../../store'
import { SubscriptionForm } from './SubscriptionForm'

export function SubscriptionList() {
  const subscriptions = useStore(s => s.subscriptions)
  const addSubscription = useStore(s => s.addSubscription)
  const updateSubscription = useStore(s => s.updateSubscription)
  const removeSubscription = useStore(s => s.removeSubscription)
  const toggleSubscription = useStore(s => s.toggleSubscription)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sorted = [...subscriptions].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return a.name.localeCompare(b.name, 'pl')
  })

  return (
    <div className="space-y-2">
      {sorted.map(subscription => (
        editingId === subscription.id ? (
          <SubscriptionForm
            key={subscription.id}
            initial={subscription}
            onSave={data => { updateSubscription(subscription.id, data); setEditingId(null) }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <SubscriptionRow
            key={subscription.id}
            subscription={subscription}
            onEdit={() => setEditingId(subscription.id)}
            onRemove={() => removeSubscription(subscription.id)}
            onToggle={() => toggleSubscription(subscription.id)}
          />
        )
      ))}

      {adding ? (
        <SubscriptionForm
          onSave={data => { addSubscription(data); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <Plus size={14} /> Dodaj abonament
        </button>
      )}
    </div>
  )
}

function SubscriptionRow({
  subscription,
  onEdit,
  onRemove,
  onToggle,
}: {
  subscription: Subscription
  onEdit: () => void
  onRemove: () => void
  onToggle: () => void
}) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${
      subscription.active ? '' : 'opacity-55'
    }`}>
      <button
        onClick={onToggle}
        className={`p-1.5 rounded-md transition-colors ${
          subscription.active
            ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        title={subscription.active ? 'Wyłącz abonament' : 'Włącz abonament'}
      >
        <Power size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{subscription.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatPLN(subscription.monthlyAmount)}/mc
          {subscription.category && ` · ${subscription.category}`}
          {subscription.nextCharge && ` · następna płatność: ${subscription.nextCharge}`}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors" title="Edytuj">
          <Pencil size={13} />
        </button>
        <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Usuń">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
