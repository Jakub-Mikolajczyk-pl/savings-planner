import { describe, expect, it } from 'vitest'
import { formatCurrencyInput, parseCurrencyInput } from '../../domain/currency'

describe('CurrencyInput helpers', () => {
  it('parses grosze written with Polish decimal comma', () => {
    expect(parseCurrencyInput('12 345,67 zł')).toBe(12345.67)
    expect(parseCurrencyInput('0,99')).toBe(0.99)
  })

  it('parses common dot/comma thousands formats', () => {
    expect(parseCurrencyInput('12,345.67')).toBe(12345.67)
    expect(parseCurrencyInput('12.345,67')).toBe(12345.67)
    expect(parseCurrencyInput('1,234')).toBe(1234)
  })

  it('formats edited values with two decimal places', () => {
    expect(formatCurrencyInput(1234.5)).toMatch(/1\s?234,50/)
  })
})
