import type { StoreId } from '../types'
import type { EmlHeaders } from './eml'

export function detectVendor(headers: EmlHeaders): StoreId | 'unknown' {
  const from = headers['from'] ?? ''
  if (from.includes('frisco.pl')) return 'frisco'
  if (from.includes('lisek.app')) return 'lisek'
  return 'unknown'
}
