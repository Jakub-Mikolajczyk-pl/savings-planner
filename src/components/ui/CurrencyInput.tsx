import { useState } from 'react'

interface Props {
  value: number
  onChange: (val: number) => void
  label?: string
  className?: string
  placeholder?: string
}

export function CurrencyInput({ value, onChange, label, className = '', placeholder = '0' }: Props) {
  const [raw, setRaw] = useState('')
  const [focused, setFocused] = useState(false)

  const handleFocus = () => {
    setRaw(value === 0 ? '' : String(value))
    setFocused(true)
  }

  const handleBlur = () => {
    setFocused(false)
    const parsed = parseFloat(raw.replace(',', '.').replace(/\s/g, ''))
    if (!isNaN(parsed) && parsed >= 0) onChange(parsed)
    setRaw('')
  }

  const displayValue = focused ? raw : (value === 0 ? '' : value.toLocaleString('pl-PL'))

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</label>}
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          placeholder={placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={e => setRaw(e.target.value)}
          className="w-full pr-8 pl-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right tabular-nums"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">zł</span>
      </div>
    </div>
  )
}
