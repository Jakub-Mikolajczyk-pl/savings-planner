import { useRef, useState } from 'react'
import { Database, Download, FileUp, RotateCcw, Upload } from 'lucide-react'
import { IS_API_MODE } from '../../config'
import { ACCOUNT_BUCKETS, BUCKET_LABELS } from '../../domain/accounts'
import { useStore } from '../../store'
import { currentYearMonth } from '../../domain/formatting'
import type { AccountBucket } from '../../domain/types'
import { ImportCsvDialog } from '../accounts/ImportCsvDialog'

export function AdvancedSettings() {
  /*
   * Ten komponent miesza dwa typy stanu:
   * - globalny domenowy stan z Zustand (settings, import/export/reset),
   * - lokalny UI state z useState/useRef (czy dialog CSV jest otwarty itd.).
   *
   * Angular porównanie:
   * Globalny Zustand przypomina singleton service/store.
   * Lokalny useState przypomina prywatne pola komponentu używane tylko w template.
   */
  const settings = useStore(s => s.settings)
  const updateSettings = useStore(s => s.updateSettings)
  const exportData = useStore(s => s.exportData)
  const importData = useStore(s => s.importData)
  const resetAll = useStore(s => s.resetAll)
  const bootstrapBackendFromLocal = useStore(s => s.bootstrapBackendFromLocal)
  const isHydrating = useStore(s => s.isHydrating)
  const syncError = useStore(s => s.syncError)
  const lastSyncedAt = useStore(s => s.lastSyncedAt)
  const clearSyncError = useStore(s => s.clearSyncError)
  /*
   * useRef trzyma mutowalną referencję, która nie powoduje rerenderu.
   * Tu potrzebujemy dostać się do ukrytego input[type=file] i kliknąć go programowo.
   *
   * Angular porównanie:
   * Podobna rola do @ViewChild('fileInput').
   */
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importCsvOpen, setImportCsvOpen] = useState(false)
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null)

  const handleExport = () => {
    /*
     * Browser API:
     * Blob = binarny/tekstowy kawałek danych.
     * URL.createObjectURL = tymczasowy URL do pobrania Blob.
     * Tworzymy <a>, klikamy go programowo, a potem sprzątamy URL.
     */
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
    /*
     * React event ma typ SyntheticEvent opakowujący natywne eventy przeglądarki.
     * Dzięki typowi React.ChangeEvent<HTMLInputElement> TypeScript wie,
     * że e.target.files istnieje.
     */
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    /*
     * FileReader działa callbackowo, nie przez Promise.
     * To starsze browser API; nowocześniejsza alternatywa to await file.text().
     */
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

  const handleBootstrap = async () => {
    /*
     * Handler eventu może być async.
     * React nie czeka na Promise z handlera, więc błędy trzeba obsłużyć w środku
     * albo w metodzie store. bootstrapBackendFromLocal zwraca wynik dla UI.
     */
    if (!confirm('Wysłać bieżące dane lokalne do pustego backendu? Operacja zatrzyma się, jeśli backend ma już dane.')) {
      return
    }

    const result = await bootstrapBackendFromLocal()
    setBootstrapMessage(result.message)
  }

  const toggleEmergencyBucket = (bucket: AccountBucket) => {
    /*
     * Checkboxy reprezentują tablicę enum-like stringów.
     * Nie mutujemy tablicy metodą push/splice, tylko tworzymy nową tablicę.
     * To fundamentalny wzorzec Reacta: immutable updates.
     */
    const current = settings.emergencyFundBuckets ?? []
    if (current.includes(bucket) && current.length === 1) return
    updateSettings({
      emergencyFundBuckets: current.includes(bucket)
        ? current.filter(item => item !== bucket)
        : [...current, bucket],
    })
  }

  return (
    <div className="space-y-5">
      {IS_API_MODE && (
        /*
         * Conditional rendering:
         * Jeśli IS_API_MODE jest false, React nie renderuje tego bloku wcale.
         * Angular porównanie: odpowiednik *ngIf="isApiMode".
         */
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Tryb API</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Backend jest źródłem prawdy. Zmiany są synchronizowane przez `/api`.
              </p>
              {lastSyncedAt && (
                /*
                 * Daty w JS są obiektami Date. Backend/Store trzyma ISO string,
                 * UI formatuje go lokalnie dopiero przy renderze.
                 */
                <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                  Ostatni sync: {new Date(lastSyncedAt).toLocaleString('pl-PL')}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBootstrap}
                disabled={isHydrating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Database size={15} />
                Wyślij dane do bazy
              </button>
              <button
                type="button"
                onClick={() => setImportCsvOpen(true)}
                disabled={isHydrating}
                className="flex items-center gap-2 px-4 py-2 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 text-sm rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <FileUp size={15} />
                Import CSV
              </button>
            </div>
          </div>

          {bootstrapMessage && (
            <p className="text-xs text-blue-700 dark:text-blue-300">{bootstrapMessage}</p>
          )}
          {syncError && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
              <p className="text-sm text-red-700 dark:text-red-300">{syncError}</p>
              <button
                type="button"
                onClick={clearSyncError}
                className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline"
              >
                Ukryj
              </button>
            </div>
          )}
        </div>
      )}

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
            /*
             * map w JSX = odpowiednik *ngFor.
             * key jest obowiązkowy dla stabilnej identyfikacji elementów listy.
             * Nie używaj index jako key, jeśli elementy mogą być dodawane/usuwane/reorderowane.
             */
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
        {!IS_API_MODE && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <Upload size={14} />
            Importuj JSON
          </button>
        )}
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

      {importCsvOpen && <ImportCsvDialog onClose={() => setImportCsvOpen(false)} />}
    </div>
  )
}
