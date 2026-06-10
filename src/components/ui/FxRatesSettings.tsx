import { useState } from 'react'
import { CloudDownload, Coins } from 'lucide-react'
import { fxApi } from '../../api/client'
import { IS_API_MODE } from '../../config'
import { BASE_CURRENCY, currenciesForRateEditor, DEFAULT_FX_RATES, fxRateToBase } from '../../domain/fx'
import { useStore } from '../../store'

/*
 * Edytor kursów walut. Salda kont w EUR/USD/CHF itd. są przeliczane na PLN
 * tymi kursami w net worth, strukturze majątku i buforach bezpieczeństwa.
 */
export function FxRatesSettings() {
  const settings = useStore(s => s.settings)
  const accounts = useStore(s => s.accounts)
  const updateSettings = useStore(s => s.updateSettings)

  const currencies = currenciesForRateEditor(accounts, settings)
  const usedCurrencies = new Set(accounts.map(account => account.currency))
  const [nbpMessage, setNbpMessage] = useState<string | null>(null)

  const fetchNbpRates = () => {
    setNbpMessage('Pobieram tabelę A z NBP...')
    fxApi.rates()
      .then(response => {
        const fxRates = { ...(settings.fxRates ?? {}) }
        let updated = 0
        for (const currency of currencies) {
          const rate = response.rates[currency]
          if (rate !== undefined && rate > 0) {
            fxRates[currency] = Math.round(rate * 10000) / 10000
            updated++
          }
        }
        updateSettings({ fxRates })
        setNbpMessage(`Zaktualizowano ${updated} kursów (${response.source}${response.effectiveDate ? `, ${response.effectiveDate}` : ''}).`)
      })
      .catch(() => setNbpMessage('Nie udało się pobrać kursów NBP — backend lub api.nbp.pl nie odpowiada.'))
  }

  const setRate = (currency: string, raw: string) => {
    const value = parseFloat(raw.replace(',', '.'))
    const fxRates = { ...(settings.fxRates ?? {}) }
    if (isNaN(value) || value <= 0) {
      delete fxRates[currency]
    } else {
      fxRates[currency] = value
    }
    updateSettings({ fxRates })
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Coins size={15} className="text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Waluty i kursy</h3>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Konta w walutach obcych są przeliczane na {settings.baseCurrency ?? BASE_CURRENCY} tym kursem
        (net worth, struktura majątku, poduszka). Puste pole = kurs domyślny.
      </p>

      {IS_API_MODE && (
        <div className="mt-3">
          <button
            type="button"
            onClick={fetchNbpRates}
            className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <CloudDownload size={13} />
            Pobierz aktualne kursy z NBP
          </button>
          {nbpMessage && <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">{nbpMessage}</p>}
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {currencies.map(currency => {
          const override = settings.fxRates?.[currency]
          const effective = fxRateToBase(currency, settings)
          return (
            <label key={currency} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                1 {currency} = … zł
                {usedCurrencies.has(currency) && (
                  <span className="ml-1.5 rounded bg-sky-50 px-1 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                    używana
                  </span>
                )}
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={override ?? ''}
                placeholder={String(DEFAULT_FX_RATES[currency] ?? 1)}
                onChange={e => setRate(currency, e.target.value)}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-right text-sm text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                aktywny kurs: {effective.toFixed(2)}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
