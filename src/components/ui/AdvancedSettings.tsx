import { useRef } from 'react'
import { Download, Upload, RotateCcw } from 'lucide-react'
import { ACCOUNT_BUCKETS, BUCKET_LABELS } from '../../domain/accounts'
import { useStore } from '../../store'
import { currentYearMonth } from '../../domain/formatting'
import type { AccountBucket } from '../../domain/types'

export function AdvancedSettings() {
  const settings = useStore(s => s.settings)
  const updateSettings = useStore(s => s.updateSettings)
  const exportData = useStore(s => s.exportData)
  const importData = useStore(s => s.importData)
  const resetAll = useStore(s => s.resetAll)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const json = exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `savings-planner-${currentYearMonth()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        importData(ev.target?.result as string)
      } catch {
        alert('Nieprawidłowy plik. Sprawdź czy to eksport z Savings Planner.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleReset = () => {
    if (confirm('Na pewno chcesz usunąć wszystkie dane? Tej operacji nie można cofnąć.')) {
      resetAll()
    }
  }

  const toggleEmergencyBucket = (bucket: AccountBucket) => {
    const current = settings.emergencyFundBuckets ?? []
    updateSettings({
      emergencyFundBuckets: current.includes(bucket)
        ? current.filter(item => item !== bucket)
        : [...current, bucket],
    })
  }

  return (
    <div className="space-y-5">
      {/* Horizon & start month */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Data startowa
          </label>
          <input
            type="month"
            value={settings.startMonth}
            onChange={e => updateSettings({ startMonth: e.target.value })}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Horyzont (miesięcy)
          </label>
          <input
            type="number"
            min={6}
            max={120}
            value={settings.horizonMonths}
            onChange={e => {
              const v = parseInt(e.target.value)
              if (!isNaN(v) && v >= 6 && v <= 120) updateSettings({ horizonMonths: v })
            }}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right tabular-nums"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Buckety funduszu awaryjnego
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACCOUNT_BUCKETS.map(bucket => (
            <label key={bucket} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={(settings.emergencyFundBuckets ?? []).includes(bucket)}
                onChange={() => toggleEmergencyBucket(bucket)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {BUCKET_LABELS[bucket]}
            </label>
          ))}
        </div>
      </div>

      {/* Export / Import */}
      <div className="flex gap-3">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
        >
          <Download size={14} />
          Eksportuj JSON
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
        >
          <Upload size={14} />
          Importuj JSON
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      </div>

      {/* Reset */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
        >
          <RotateCcw size={14} />
          Resetuj wszystkie dane
        </button>
        <p className="text-xs text-gray-400 mt-1">Usuwa cele, konta, kredyty, ustawienia i overrides z localStorage.</p>
      </div>
    </div>
  )
}
