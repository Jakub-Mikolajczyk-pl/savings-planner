import { useState } from 'react'
import type { FormEvent } from 'react'
import { FileUp, Upload } from 'lucide-react'
import { IS_API_MODE } from '../../config'
import type { BankSource, IngestResult } from '../../domain/types'
import { useStore } from '../../store'

const BANK_LABELS: Record<BankSource, string> = {
  ALIOR_CSV: 'Alior CSV',
  VELO_PDF: 'Velo PDF',
}

export function IngestSection() {
  const accounts = useStore(s => s.accounts)
  const importBankStatement = useStore(s => s.importBankStatement)
  const syncError = useStore(s => s.syncError)
  const [bank, setBank] = useState<BankSource>('ALIOR_CSV')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [file, setFile] = useState<File | undefined>()
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<IngestResult | undefined>()
  const selectedAccountId = accountId || accounts[0]?.id || ''

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file || !selectedAccountId) return

    setIsUploading(true)
    setResult(undefined)
    try {
      setResult(await importBankStatement(bank, selectedAccountId, file))
      setFile(undefined)
    } finally {
      setIsUploading(false)
    }
  }

  if (!IS_API_MODE) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Import wyciagu bankowego jest dostepny w trybie API.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[12rem_minmax(14rem,1fr)_minmax(16rem,1fr)_auto] md:items-end">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Bank</span>
          <select
            value={bank}
            onChange={event => setBank(event.target.value as BankSource)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
          >
            {Object.entries(BANK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Konto</span>
          <select
            value={selectedAccountId}
            onChange={event => setAccountId(event.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
          >
            {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Plik</span>
          <input
            type="file"
            accept=".csv,.pdf,text/csv,application/pdf"
            onChange={event => setFile(event.target.files?.[0])}
            className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-2.5 file:py-1.5 file:text-sm file:text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:file:bg-gray-800 dark:file:text-gray-200"
          />
        </label>

        <button
          type="submit"
          disabled={!file || !selectedAccountId || isUploading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-950 px-3 py-2 text-sm text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
        >
          {isUploading ? <Upload size={16} className="animate-spin" /> : <FileUp size={16} />}
          Importuj
        </button>
      </div>

      {accounts.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Najpierw dodaj konto w zakladce Majatek, bo import musi wiedziec, do ktorego rachunku przypisac transakcje.
        </p>
      )}

      {result && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Zaimportowano <span className="font-medium text-gray-900 dark:text-gray-100">{result.inserted}</span>,
          pominieto duplikaty <span className="font-medium text-gray-900 dark:text-gray-100">{result.skipped}</span>.
        </p>
      )}

      {syncError && <p className="text-sm text-rose-600 dark:text-rose-400">{syncError}</p>}
    </form>
  )
}

