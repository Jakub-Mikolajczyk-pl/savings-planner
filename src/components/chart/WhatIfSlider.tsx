import { useStore } from '../../store'
import { formatPLN } from '../../domain/formatting'

export function WhatIfSlider() {
  const whatIfDelta = useStore(s => s.whatIfDelta)
  const setWhatIfDelta = useStore(s => s.setWhatIfDelta)
  const loanOverpayment = useStore(s => s.loanOverpayment)
  const setLoanOverpayment = useStore(s => s.setLoanOverpayment)
  const loans = useStore(s => s.loans)

  return (
    <div className="space-y-4">
      {/* Income what-if */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Co jeśli zmienię dochód o:</span>
          <span className={`font-bold tabular-nums ${
            whatIfDelta > 0 ? 'text-green-600 dark:text-green-400' :
            whatIfDelta < 0 ? 'text-red-600 dark:text-red-400' :
            'text-gray-400'
          }`}>
            {whatIfDelta === 0 ? 'bez zmian' : (whatIfDelta > 0 ? '+' : '') + formatPLN(whatIfDelta) + '/mies.'}
          </span>
        </div>
        <input
          type="range"
          min={-5000}
          max={10000}
          step={100}
          value={whatIfDelta}
          onChange={e => setWhatIfDelta(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>−5 000 zł</span>
          <button onClick={() => setWhatIfDelta(0)} className="text-blue-500 hover:text-blue-700 underline">reset</button>
          <span>+10 000 zł</span>
        </div>
      </div>

      {/* Loan overpayment what-if — only when loans exist */}
      {loans.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Co jeśli nadpłacam kredyty o:</span>
            <span className={`font-bold tabular-nums ${loanOverpayment > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>
              {loanOverpayment === 0 ? 'bez nadpłaty' : `+${formatPLN(loanOverpayment)}/mies.`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10000}
            step={100}
            value={loanOverpayment}
            onChange={e => setLoanOverpayment(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0 zł</span>
            <button onClick={() => setLoanOverpayment(0)} className="text-orange-500 hover:text-orange-700 underline">reset</button>
            <span>+10 000 zł</span>
          </div>
        </div>
      )}

      {(whatIfDelta !== 0 || loanOverpayment > 0) && (
        <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
          Przerywane linie na wykresie = scenariusz. Twoje dane nie zostały zmienione.
        </p>
      )}
    </div>
  )
}
