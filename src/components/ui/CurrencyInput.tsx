import { useEffect, useRef, useState } from 'react'
import { formatCurrencyInput, parseCurrencyInput, sanitizeCurrencyInput } from '../../domain/currency'

interface Props {
  value: number
  onChange: (val: number) => void
  label?: string
  className?: string
  placeholder?: string
}

export function CurrencyInput({ value, onChange, label, className = '', placeholder = '0,00' }: Props) {
  /*
   * Parent stores the domain number, while this component stores the editable
   * text. That lets the user type decimal separators naturally, then we format
   * to Polish money notation on blur.
   */
  const [display, setDisplay] = useState(value === 0 ? '' : formatCurrencyInput(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) {
      setDisplay(value === 0 ? '' : formatCurrencyInput(value))
    }
  }, [value])

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focused.current = true
    e.target.select()
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    focused.current = false
    const num = parseCurrencyInput(e.target.value)
    if (num === null || num === 0) {
      onChange(0)
      setDisplay('')
      return
    }

    onChange(num)
    setDisplay(formatCurrencyInput(num))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeCurrencyInput(e.target.value)
    const num = parseCurrencyInput(raw)

    if (num === null) {
      setDisplay('')
      onChange(0)
      return
    }

    onChange(num)
    setDisplay(raw)
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
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
