import { useMemo, useState } from 'react'
import { FileUp, X } from 'lucide-react'
import { ACCOUNT_BUCKETS, BUCKET_LABELS } from '../../domain/accounts'
import { currentYearMonth } from '../../domain/formatting'
import { useStore } from '../../store'
import type { CsvColumnMapping, CsvImportResult } from '../../api/client'
import type { AccountBucket } from '../../domain/types'

interface Props {
  onClose: () => void
}

const detectDelimiter = (line: string) =>
  /*
   * Mała heurystyka pod CSV z Polski:
   * arkusze często używają ;, bo przecinek bywa separatorem dziesiętnym.
   */
  (line.match(/;/g)?.length ?? 0) >= (line.match(/,/g)?.length ?? 0) ? ';' : ','

const splitCsvLine = (line: string, delimiter: string) => {
  /*
   * Minimalny parser CSV jako state machine:
   * - inQuotes=false: delimiter kończy kolumnę,
   * - inQuotes=true: delimiter jest zwykłym znakiem tekstu.
   *
   * Rekrutacyjnie:
   * To nie jest pełny parser CSV RFC 4180, ale pokazuje mechanikę.
   * Dla dzikich CSV lepiej użyć biblioteki.
   */
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

export function ImportCsvDialog({ onClose }: Props) {
  /*
   * Dialog ma dużo lokalnego state, bo jest "formularzem-wizardem".
   * Nie wszystko musi iść do globalnego store. Globalny store trzyma dane domenowe,
   * a lokalny useState trzyma tymczasowe drafty UI.
   */
  const accounts = useStore(s => s.accounts)
  const importAccountSnapshotsCsv = useStore(s => s.importAccountSnapshotsCsv)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [year, setYear] = useState(Number(currentYearMonth().slice(0, 4)))
  const [mappings, setMappings] = useState<Record<string, CsvColumnMapping>>({})
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const accountHeaders = useMemo(() => headers.slice(1).filter(Boolean), [headers])

  const updateMapping = (header: string, patch: Partial<CsvColumnMapping>) => {
    /*
     * Functional setState:
     * setMappings(current => next) jest bezpieczniejsze, gdy nowy stan zależy
     * od poprzedniego. React może batchować aktualizacje.
     */
    setMappings(current => {
      const previous = current[header] ?? { action: 'skip' as const, currency: 'PLN' }
      return {
        ...current,
        [header]: { ...previous, ...patch },
      }
    })
  }

  const handleFile = (nextFile: File | undefined) => {
    if (!nextFile) return
    setFile(nextFile)
    setResult(null)
    setError(null)

    const reader = new FileReader()
    reader.onload = event => {
      /*
       * Po wybraniu pliku czytamy tylko nagłówek, żeby zbudować UI mapowania.
       * Sam import pełnego pliku robi backend, bo tam jest logika domenowa
       * i transakcja bazy danych.
       */
      const firstLine = String(event.target?.result ?? '').split(/\r?\n/).find(line => line.trim())
      if (!firstLine) {
        setError('CSV nie ma nagłówka.')
        return
      }

      const parsedHeaders = splitCsvLine(firstLine, detectDelimiter(firstLine))
      setHeaders(parsedHeaders)
      setMappings(
        Object.fromEntries(
          parsedHeaders.slice(1).filter(Boolean).map(header => [
            header,
            {
              action: 'new',
              name: header,
              bucket: 'accounts' as AccountBucket,
              currency: 'PLN',
            },
          ]),
        ),
      )
    }
    reader.readAsText(nextFile)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    /*
     * Formularz HTML domyślnie robi page reload.
     * preventDefault zatrzymuje nawigację, żeby React mógł obsłużyć submit w SPA.
     */
    event.preventDefault()
    if (!file) return

    setIsImporting(true)
    setError(null)
    setResult(null)
    try {
      const response = await importAccountSnapshotsCsv(file, { year, columns: mappings })
      setResult(response)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import CSV nie powiódł się.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 px-4 py-8">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import CSV stanów kont</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Mapowanie kolumn arkusza na konta w backendzie</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Zamknij"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Plik CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={event => handleFile(event.target.files?.[0])}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rok</span>
              <input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={event => setYear(Number(event.target.value))}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 text-right"
              />
            </label>
          </div>

        {accountHeaders.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Kolumny kont
              </p>
              {accountHeaders.map(header => {
                /*
                 * Controlled inputs:
                 * value pochodzi ze state, onChange aktualizuje state.
                 *
                 * Angular porównanie:
                 * To najbliżej [(ngModel)] albo reactive forms FormControl,
                 * tylko bez osobnej abstrakcji formularzy.
                 */
                const mapping = mappings[header] ?? { action: 'skip' as const, currency: 'PLN' }
                return (
                  <div key={header} className="grid gap-2 rounded-lg border border-gray-100 dark:border-gray-800 p-3 md:grid-cols-[1fr_130px_1fr_160px_80px] md:items-end">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{header}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Nagłówek z CSV</p>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Akcja</span>
                      <select
                        value={mapping.action}
                        onChange={event => updateMapping(header, { action: event.target.value as CsvColumnMapping['action'] })}
                        className="px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      >
                        <option value="new">Nowe</option>
                        <option value="existing">Istniejące</option>
                        <option value="skip">Pomiń</option>
                      </select>
                    </label>

                    {mapping.action === 'existing' ? (
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Konto</span>
                        <select
                          value={mapping.accountId ?? ''}
                          onChange={event => updateMapping(header, { accountId: event.target.value })}
                          className="px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                          required
                        >
                          <option value="">Wybierz konto</option>
                          {accounts.map(account => (
                            <option key={account.id} value={account.id}>{account.name}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Nazwa</span>
                        <input
                          type="text"
                          value={mapping.name ?? header}
                          onChange={event => updateMapping(header, { name: event.target.value })}
                          disabled={mapping.action === 'skip'}
                          className="px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm disabled:opacity-50"
                        />
                      </label>
                    )}

                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Bucket</span>
                      <select
                        value={mapping.bucket ?? 'accounts'}
                        onChange={event => updateMapping(header, { bucket: event.target.value as AccountBucket })}
                        disabled={mapping.action !== 'new'}
                        className="px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm disabled:opacity-50"
                      >
                        {ACCOUNT_BUCKETS.map(bucket => (
                          <option key={bucket} value={bucket}>{BUCKET_LABELS[bucket]}</option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Waluta</span>
                      <input
                        type="text"
                        maxLength={3}
                        value={mapping.currency ?? 'PLN'}
                        onChange={event => updateMapping(header, { currency: event.target.value.toUpperCase() })}
                        disabled={mapping.action === 'skip'}
                        className="px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm uppercase disabled:opacity-50"
                      />
                    </label>
                  </div>
                )
              })}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          {result && (
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm text-green-700 dark:text-green-300">
              <p>Zaimportowano {result.snapshotsImported} snapshotów dla {result.accounts.length} kont.</p>
              {result.warnings.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {result.warnings.map(warning => (
                    <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Zamknij
            </button>
            <button
              type="submit"
              disabled={!file || isImporting}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white dark:disabled:bg-gray-700 text-white text-sm font-medium rounded-md"
            >
              <FileUp size={15} />
              {isImporting ? 'Importuję...' : 'Importuj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
