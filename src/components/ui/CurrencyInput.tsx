import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  onChange: (val: number) => void
  label?: string
  className?: string
  placeholder?: string
}

export function CurrencyInput({ value, onChange, label, className = '', placeholder = '0' }: Props) {
  /*
   * CurrencyInput pokazuje ważny React pattern:
   * parent trzyma wartość liczbową (value), a komponent lokalnie trzyma string
   * do wyświetlenia z separatorami tysięcy.
   *
   * Dlaczego dwa stany?
   * Liczba 10000 jest dobra dla domeny, ale użytkownik chce widzieć "10 000".
   * Input HTML zawsze operuje stringami.
   */
  const [display, setDisplay] = useState(value === 0 ? '' : value.toLocaleString('pl-PL'))
  /*
   * useRef jako flaga "czy user teraz edytuje".
   * Zmiana ref.current nie robi rerenderu, więc nadaje się do takich technicznych flag.
   */
  const focused = useRef(false)

  /*
   * Synchronizujemy display z zewnętrznym value tylko gdy input nie jest aktywnie
   * edytowany. Inaczej parent update mógłby przesuwać kursor podczas pisania.
   */
  useEffect(() => {
    if (!focused.current) {
      setDisplay(value === 0 ? '' : value.toLocaleString('pl-PL'))
    }
  }, [value])

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focused.current = true
    e.target.select()
  }

  const handleBlur = () => {
    focused.current = false
    // Normalize display to match stored value
    setDisplay(value === 0 ? '' : value.toLocaleString('pl-PL'))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    /*
     * JS string/regex:
     * replace(/[^\d]/g, '') usuwa wszystko poza cyframi.
     * Dzięki temu "12 345 zł" i "12345" prowadzą do tej samej liczby.
     */
    const raw = e.target.value
    const digits = raw.replace(/[^\d]/g, '')

    if (digits === '') {
      setDisplay('')
      onChange(0)
      return
    }

    const num = parseInt(digits, 10)
    onChange(num)

    /*
     * toLocaleString('pl-PL') formatuje liczbę wg polskich ustawień.
     * To API przeglądarki/Intl, nie biblioteka Reacta.
     */
    const formatted = num.toLocaleString('pl-PL')
    setDisplay(formatted)
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        /*
         * Krótkie && w JSX:
         * Jeśli label jest pusty/undefined, React nie renderuje elementu.
         */
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={display}
          placeholder={placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className="w-full pr-8 pl-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right tabular-nums"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          zł
        </span>
      </div>
    </div>
  )
}
