import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2, Plus, Lock } from 'lucide-react'
import { useStore } from '../../store'
import { formatPLN } from '../../domain/formatting'
import type { Goal } from '../../domain/types'
import { GoalForm } from './GoalForm'

function SortableGoalRow({ goal, onEdit, onRemove }: { goal: Goal; onEdit: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: goal.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:gap-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 dark:text-gray-600 hover:text-gray-500 cursor-grab active:cursor-grabbing"
        aria-label="Przeciągnij"
      >
        <GripVertical size={16} />
      </button>

      <span className="w-5 h-5 flex items-center justify-center text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-full shrink-0">
        {goal.priority}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100">{goal.name}</span>
          {goal.fixedAllocation && (
            <Lock size={12} className="text-purple-500 shrink-0" title={`Stała alokacja ${formatPLN(goal.fixedAllocation)}/mies.`} />
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-snug text-gray-500 dark:text-gray-400">
          <span>{formatPLN(goal.targetAmount)}</span>
          {goal.deadline && <span>· termin: {new Date(goal.deadline).toLocaleDateString('pl-PL')}</span>}
          {goal.fixedAllocation && <span>· {formatPLN(goal.fixedAllocation)}/mies. (stałe)</span>}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          aria-label="Edytuj"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          aria-label="Usuń"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export function GoalList() {
  const goals = useStore(s => s.goals)
  const addGoal = useStore(s => s.addGoal)
  const updateGoal = useStore(s => s.updateGoal)
  const removeGoal = useStore(s => s.removeGoal)
  const reorderGoals = useStore(s => s.reorderGoals)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const sorted = [...goals].sort((a, b) => a.priority - b.priority)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sorted.findIndex(g => g.id === active.id)
    const newIndex = sorted.findIndex(g => g.id === over.id)

    const reordered = [...sorted]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    reorderGoals(reordered.map(g => g.id))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Przeciągnij cele żeby zmienić kolejność priorytetów. Cel #1 = najwyższy priorytet (alokacja najpierw po stałych kwotach).
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map(g => g.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sorted.map(goal =>
              editingId === goal.id ? (
                <div key={goal.id} className="p-4 border border-blue-300 dark:border-blue-700 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">Edytuj cel</p>
                  <GoalForm
                    initial={goal}
                    onSave={data => { updateGoal(goal.id, data); setEditingId(null) }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <SortableGoalRow
                  key={goal.id}
                  goal={goal}
                  onEdit={() => setEditingId(goal.id)}
                  onRemove={() => removeGoal(goal.id)}
                />
              ),
            )}
          </div>
        </SortableContext>
      </DndContext>

      {adding ? (
        <div className="p-4 border border-green-300 dark:border-green-700 rounded-xl bg-green-50 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-3">Nowy cel</p>
          <GoalForm
            onSave={data => { addGoal(data); setAdding(false) }}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Plus size={16} />
          Dodaj cel
        </button>
      )}
    </div>
  )
}
