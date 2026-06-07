import { useRef, useState } from 'react'
import { FileUp, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useStore } from '../../store'
import type { ImportSummary } from '../../domain/types'

interface Props {
  onClose: () => void
}

const REASON_LABELS: Record<string, string> = {
  unknown_vendor: 'Nieznany nadawca (nie Frisco ani Lisek)',
  unknown_template: 'Nieznany szablon maila',
  no_items: 'Brak pozycji w zamówieniu',
  parse_error: 'Błąd parsowania',
}

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason
}

export function ImportEmailsDialog({ onClose }: Props) {
  const importBasketEmails = useStore(s => s.importBasketEmails)

  const [files, setFiles] = useState<File[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (next: FileList | null) => {
    if (!next || next.length === 0) return
    setFiles(Array.from(next))
    setSummary(null)
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (files.length === 0) return

    setIsImporting(true)
    setError(null)
    setSummary(null)
    try {
      const result = await importBasketEmails(files)
      setSummary(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import nie powiódł się.')
    } finally {
      setIsImporting(false)
    }
  }

  const hasDuplicatesOnly =
    summary !== null &&
    summary.observationsAdded === 0 &&
    summary.observationsDuplicate > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 px-4 py-8">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Import potwierdzeń zamówień (.eml)
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Frisco i Lisek — parsowanie po stronie przeglądarki
            </p>
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
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Pliki .eml
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".eml,message/rfc822"
              multiple
              onChange={event => handleFiles(event.target.files)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
              required
            />
            {files.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Wybrano {files.length} {files.length === 1 ? 'plik' : files.length < 5 ? 'pliki' : 'plików'}
              </p>
            )}
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {summary && (
            <div className="space-y-3">
              <div className={`rounded-lg border px-4 py-3 text-sm space-y-1 ${
                hasDuplicatesOnly
                  ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
                  : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              }`}>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 size={15} className="shrink-0" />
                  {hasDuplicatesOnly
                    ? 'Wszystkie obserwacje już zaimportowane'
                    : 'Import zakończony'}
                </div>
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    <tr>
                      <td className="py-0.5 pr-4 opacity-70">Pliki przetworzone</td>
                      <td className="font-mono font-medium">
                        {summary.filesOk} / {summary.filesTotal}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-4 opacity-70">Zamówienia</td>
                      <td className="font-mono font-medium">{summary.ordersParsed}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-4 opacity-70">Nowe produkty</td>
                      <td className="font-mono font-medium">{summary.itemsNew}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-4 opacity-70">Obserwacje dodane</td>
                      <td className="font-mono font-medium">{summary.observationsAdded}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-4 opacity-70">Duplikaty (pominięte)</td>
                      <td className="font-mono font-medium">{summary.observationsDuplicate}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {summary.filesError.length > 0 && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm">
                  <p className="font-medium text-red-700 dark:text-red-300 mb-2">
                    Pliki z błędami ({summary.filesError.length})
                  </p>
                  <ul className="space-y-1">
                    {summary.filesError.map(({ name, reason }) => (
                      <li key={name} className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                        <AlertCircle size={12} className="mt-0.5 shrink-0" />
                        <span>
                          <span className="font-medium">{name}</span>
                          {' — '}
                          {reasonLabel(reason)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
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
              disabled={files.length === 0 || isImporting}
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
