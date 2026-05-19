import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  badge?: string
}

export function Collapsible({ title, defaultOpen = false, children, badge }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-left transition-colors"
      >
        {open ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
        <span className="font-medium text-gray-800 dark:text-gray-200">{title}</span>
        {badge && (
          <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}
