import { Fragment, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileUp,
  GitMerge,
  Pencil,
  Plus,
  Scale,
  Settings,
  ShoppingBasket,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { useStore } from '../../store'
import {
  cpiYoY,
  itemTrend,
  monthOf,
  personalCpiSeries,
  topMovers,
} from '../../domain/basket/inflationBasket'
import { PageHeader, SectionCard, StatCard, surface } from '../ui/Layout'
import { ImportEmailsDialog } from './ImportEmailsDialog'
import type { BasketConfig, BasketItem, BasketItemKind, PriceObservation } from '../../domain/types'

// ─── formatting helpers ───────────────────────────────────────────────────────

function fmtPrice(v: number | undefined): string {
  if (v === undefined) return '—'
  return v.toFixed(2).replace('.', ',') + ' zł'
}

function fmtPct(v: number | undefined): string {
  if (v === undefined) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}

function pctTone(v: number | undefined): string {
  if (v === undefined) return 'text-gray-400 dark:text-gray-500'
  if (v > 0) return 'text-rose-600 dark:text-rose-400'
  if (v < 0) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-gray-600 dark:text-gray-300'
}

// ─── per-item derived row data ────────────────────────────────────────────────

interface RowData {
  item: BasketItem
  lastPrice: number | undefined
  lastPricePerKg: number | undefined
  deltaBase: number | undefined
  deltaLast: number | undefined
  obsCount: number
  stores: string[]
  trendPoints: { date: string; unitPrice: number }[]
}

function buildRows(items: BasketItem[], observations: PriceObservation[]): RowData[] {
  return items.map(item => {
    const obs = observations.filter(o => o.itemId === item.id)
    const sorted = [...obs].sort((a, b) => a.date.localeCompare(b.date))
    const last = sorted.at(-1)
    const trend = itemTrend(item.id, observations)
    const stores = [...new Set(obs.map(o => o.store))]
    return {
      item,
      lastPrice: last?.unitPrice,
      lastPricePerKg: last?.normalizedUnitPrice,
      deltaBase: trend.deltaVsBasePct,
      deltaLast: trend.deltaVsLastBuyPct,
      obsCount: obs.length,
      stores,
      trendPoints: trend.points,
    }
  })
}

// ─── sort ─────────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'lastPrice' | 'pricePerKg' | 'deltaBase' | 'deltaLast' | 'obsCount'
interface Sort { key: SortKey; dir: 'asc' | 'desc' }

function applySort(rows: RowData[], sort: Sort): RowData[] {
  const cmp = (a: RowData, b: RowData): number => {
    switch (sort.key) {
      case 'name':       return a.item.displayName.localeCompare(b.item.displayName, 'pl')
      case 'lastPrice':  return (a.lastPrice ?? Infinity) - (b.lastPrice ?? Infinity)
      case 'pricePerKg': return (a.lastPricePerKg ?? Infinity) - (b.lastPricePerKg ?? Infinity)
      case 'deltaBase':  return (a.deltaBase ?? 0) - (b.deltaBase ?? 0)
      case 'deltaLast':  return (a.deltaLast ?? 0) - (b.deltaLast ?? 0)
      case 'obsCount':   return a.obsCount - b.obsCount
    }
  }
  return [...rows].sort((a, b) => sort.dir === 'asc' ? cmp(a, b) : -cmp(a, b))
}

// ─── sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ points }: { points: { date: string; unitPrice: number }[] }) {
  if (points.length < 2) return <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
  const W = 48; const H = 18
  const prices = points.map(p => p.unitPrice)
  const min = Math.min(...prices); const max = Math.max(...prices)
  const range = max - min || 1
  const xs = points.map((_, i) => (i / (points.length - 1)) * W)
  const ys = prices.map(p => H - ((p - min) / range) * H)
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const rising = prices.at(-1)! > prices[0]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <path d={d} fill="none" stroke={rising ? '#e11d48' : '#059669'} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

// ─── sortable header cell ─────────────────────────────────────────────────────

function SortTh({
  label, sortKey, sort, onSort, align = 'right', className = '',
}: {
  label: string; sortKey: SortKey; sort: Sort; onSort: (k: SortKey) => void
  align?: 'left' | 'right'; className?: string
}) {
  const active = sort.key === sortKey
  const Icon = active && sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={`py-2 ${align === 'right' ? 'text-right pr-3' : 'text-left pl-3'} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-xs font-medium rounded-sm transition-colors hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
      >
        <span>{label}</span>
        <Icon size={12} className={active ? 'opacity-100' : 'opacity-35'} />
      </button>
    </th>
  )
}

// ─── store badge ──────────────────────────────────────────────────────────────

const STORE_LABEL: Record<string, string> = { frisco: 'F', lisek: 'L' }
const STORE_COLOR: Record<string, string> = {
  frisco: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  lisek: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
}

function StoreBadge({ store }: { store: string }) {
  return (
    <span className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${STORE_COLOR[store] ?? 'bg-gray-100 text-gray-600'}`}>
      {STORE_LABEL[store] ?? store[0].toUpperCase()}
    </span>
  )
}

// ─── kind labels ─────────────────────────────────────────────────────────────

const KIND_LABELS: Record<BasketItemKind, string> = {
  food: 'Żywność',
  household: 'Chemia / dom',
  pet: 'Zwierzęta',
  supplement: 'Suplementy',
  other: 'Inne',
}

// ─── config panel ─────────────────────────────────────────────────────────────

function BasketConfigPanel({
  config, onChange, earliestMonth,
}: {
  config: BasketConfig
  onChange: (patch: Partial<BasketConfig>) => void
  earliestMonth: string | undefined
}) {
  const [newMonth, setNewMonth] = useState('')
  const [newValue, setNewValue] = useState('')

  const gusEntries = useMemo(
    () => [...(config.officialCpi ?? [])].sort((a, b) => a.month.localeCompare(b.month)),
    [config.officialCpi],
  )

  const addGus = () => {
    const v = parseFloat(newValue.replace(',', '.'))
    if (!/^\d{4}-\d{2}$/.test(newMonth) || isNaN(v)) return
    const updated = [
      ...(config.officialCpi ?? []).filter(p => p.month !== newMonth),
      { month: newMonth, valuePct: v },
    ].sort((a, b) => a.month.localeCompare(b.month))
    onChange({ officialCpi: updated })
    setNewMonth(''); setNewValue('')
  }

  const removeGus = (month: string) =>
    onChange({ officialCpi: (config.officialCpi ?? []).filter(p => p.month !== month) })

  const fc = 'w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400'
  const lc = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

  return (
    <SectionCard
      title="Konfiguracja indeksu"
      icon={Settings}
      accent="settings"
      collapsible
      defaultOpen={false}
      collapsedSummary={
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Metoda: <strong>{config.method === 'laspeyres' ? 'Laspeyres' : 'Wagi wydatkowe'}</strong>
          {' · '}Próg: <strong>{config.trackingThreshold} obs.</strong>
          {config.basePeriod && <> · Baza: <strong>{config.basePeriod}</strong></>}
          {gusEntries.length > 0 && <> · GUS: <strong>{gusEntries.length} pkt.</strong></>}
        </span>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className={lc}>Okres bazowy (YYYY-MM)</label>
            <input
              type="text"
              placeholder={earliestMonth ?? 'auto (najwcześniejszy)'}
              value={config.basePeriod ?? ''}
              onChange={e => { const v = e.target.value.trim(); onChange({ basePeriod: v || undefined }) }}
              className={fc}
            />
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Puste = pierwszy miesiąc z danymi ({earliestMonth ?? '—'})
            </p>
          </div>
          <div>
            <label className={lc}>Metoda indeksu</label>
            <select value={config.method} onChange={e => onChange({ method: e.target.value as BasketConfig['method'] })} className={fc}>
              <option value="laspeyres">Laspeyres (stały koszyk z bazy)</option>
              <option value="spend_weighted">Wagi wydatkowe</option>
            </select>
          </div>
          <div>
            <label className={lc}>Próg śledzenia (min. obserwacji)</label>
            <input
              type="number" min={1} max={50} value={config.trackingThreshold}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) onChange({ trackingThreshold: v }) }}
              className={`${fc} text-right`}
            />
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Produkty z mniej obserwacjami są automatycznie wykluczone z indeksu.
            </p>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox" checked={config.excludeWeightItems}
              onChange={e => onChange({ excludeWeightItems: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Wyklucz produkty na wagę z indeksu</span>
          </label>
        </div>

        <div>
          <p className={lc}>Nakładka GUS (% r/r — ręczny wpis)</p>
          {gusEntries.length > 0 ? (
            <div className="mb-3 rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="py-1.5 pl-3 text-left text-gray-500 dark:text-gray-400 font-medium">Miesiąc</th>
                    <th className="py-1.5 pr-3 text-right text-gray-500 dark:text-gray-400 font-medium">CPI r/r</th>
                    <th className="py-1.5 pr-2 w-6" />
                  </tr>
                </thead>
                <tbody>
                  {gusEntries.map(p => (
                    <tr key={p.month} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="py-1.5 pl-3 font-mono text-gray-700 dark:text-gray-300">{p.month}</td>
                      <td className={`py-1.5 pr-3 text-right tabular-nums font-medium ${pctTone(p.valuePct)}`}>{fmtPct(p.valuePct)}</td>
                      <td className="py-1.5 pr-2">
                        <button type="button" onClick={() => removeGus(p.month)}
                          className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-rose-500 dark:hover:text-rose-400 rounded" aria-label={`Usuń GUS ${p.month}`}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
              Brak danych GUS. Dodaj punkty poniżej.
            </p>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className={lc}>Miesiąc</label>
              <input type="text" placeholder="RRRR-MM" value={newMonth} onChange={e => setNewMonth(e.target.value)} className={fc} maxLength={7} />
            </div>
            <div className="w-24">
              <label className={lc}>% r/r</label>
              <input type="text" placeholder="np. 4,3" value={newValue} onChange={e => setNewValue(e.target.value)} className={`${fc} text-right`} />
            </div>
            <button type="button" onClick={addGus} disabled={!/^\d{4}-\d{2}$/.test(newMonth) || newValue.trim() === ''}
              className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors">
              <Plus size={13} />Dodaj
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}

// ─── drill-down panel (T5 price history + T7 edit/merge/delete) ───────────────

type DrillMode = 'view' | 'edit' | 'merge'

function DrillDown({
  row,
  observations,
  allItems,
  onClose,
  onUpdate,
  onMerge,
  onRemove,
}: {
  row: RowData
  observations: PriceObservation[]
  allItems: BasketItem[]
  onClose: () => void
  onUpdate: (patch: Partial<Pick<BasketItem, 'displayName' | 'unit' | 'packageSize' | 'kind'>>) => void
  onMerge: (sourceId: string) => void
  onRemove: () => void
}) {
  const [mode, setMode] = useState<DrillMode>('view')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // edit form state
  const [editName, setEditName] = useState(row.item.displayName)
  const [editUnit, setEditUnit] = useState(row.item.unit)
  const [editSize, setEditSize] = useState(row.item.packageSize?.toString() ?? '')
  const [editKind, setEditKind] = useState<BasketItemKind>(row.item.kind)

  // merge state
  const [mergeSourceId, setMergeSourceId] = useState('')

  const itemObs = observations
    .filter(o => o.itemId === row.item.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  const scatterData = itemObs.map(o => ({
    x: o.date, y: o.unitPrice, store: o.store, qty: o.quantity, orderRef: o.orderRef,
  }))

  const uniqueOrders = [...new Map(itemObs.map(o => [o.orderRef, o])).values()]
    .sort((a, b) => b.date.localeCompare(a.date))

  const mergeSource = allItems.find(i => i.id === mergeSourceId)

  const handleSave = () => {
    const size = editSize.trim() !== '' ? parseFloat(editSize.replace(',', '.')) : undefined
    onUpdate({
      displayName: editName.trim() || row.item.displayName,
      unit: editUnit,
      packageSize: size !== undefined && !isNaN(size) ? size : undefined,
      kind: editKind,
    })
    setMode('view')
  }

  const handleMerge = () => {
    if (!mergeSourceId) return
    onMerge(mergeSourceId)
  }

  const fc = 'w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400'

  const mergeOtherItems = allItems.filter(i => i.id !== row.item.id)

  return (
    <div className={`${surface} p-5 mt-1`}>
      {/* header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.item.displayName}</p>
          {row.item.brand && <p className="text-xs text-gray-500 dark:text-gray-400">{row.item.brand}</p>}
        </div>
        <div className="flex items-center gap-1">
          {/* edit toggle */}
          <button
            type="button"
            onClick={() => setMode(m => m === 'edit' ? 'view' : 'edit')}
            title="Edytuj pozycję"
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              mode === 'edit'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Pencil size={12} />Edytuj
          </button>
          {/* merge toggle */}
          <button
            type="button"
            onClick={() => { setMode(m => m === 'merge' ? 'view' : 'merge'); setMergeSourceId('') }}
            title="Scal z inną pozycją"
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              mode === 'merge'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <GitMerge size={12} />Scal
          </button>
          {/* delete */}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            title="Usuń pozycję"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-900/20 transition-colors"
          >
            <Trash2 size={12} />Usuń
          </button>
          {/* close */}
          <button type="button" onClick={onClose}
            className="ml-1 p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Zamknij">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* delete confirmation */}
      {confirmDelete && (
        <div className="mb-4 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm">
          <p className="font-medium text-rose-700 dark:text-rose-300">
            Usunąć „{row.item.displayName}" i wszystkie {row.obsCount} obserwacje?
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onRemove}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700">
              Usuń
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}
              className="rounded-md border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* edit form */}
      {mode === 'edit' && (
        <div className="mb-4 rounded-lg border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-900/10 p-4 space-y-3">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-1">Edytuj pozycję</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nazwa wyświetlana</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={fc} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Kategoria</label>
              <select value={editKind} onChange={e => setEditKind(e.target.value as BasketItemKind)} className={fc}>
                {(Object.entries(KIND_LABELS) as [BasketItemKind, string][]).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Jednostka</label>
              <select value={editUnit} onChange={e => setEditUnit(e.target.value as BasketItem['unit'])} className={fc}>
                {(['g', 'kg', 'ml', 'l', 'szt'] as const).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Rozmiar opakowania</label>
              <input
                type="text"
                placeholder={`np. 200 (${editUnit})`}
                value={editSize}
                onChange={e => setEditSize(e.target.value)}
                className={`${fc} text-right`}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleSave}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
              Zapisz
            </button>
            <button type="button" onClick={() => setMode('view')}
              className="rounded-md border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* merge panel */}
      {mode === 'merge' && (
        <div className="mb-4 rounded-lg border border-amber-100 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-900/10 p-4 space-y-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">Scal z inną pozycją</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Obserwacje wybranej pozycji zostaną przeniesione tutaj. Źródło zostanie usunięte.
          </p>
          {mergeOtherItems.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">Brak innych pozycji do scalenia.</p>
          ) : (
            <>
              <select value={mergeSourceId} onChange={e => setMergeSourceId(e.target.value)} className={fc}>
                <option value="">Wybierz pozycję (zostanie usunięta)…</option>
                {mergeOtherItems
                  .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pl'))
                  .map(i => <option key={i.id} value={i.id}>{i.displayName}</option>)}
              </select>
              {mergeSource && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  „{mergeSource.displayName}" ({observations.filter(o => o.itemId === mergeSource.id).length} obs.) → „{row.item.displayName}"
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={handleMerge} disabled={!mergeSourceId}
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-40">
                  Scal
                </button>
                <button type="button" onClick={() => setMode('view')}
                  className="rounded-md border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  Anuluj
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* price history + orders */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Historia ceny</p>
          {scatterData.length < 2 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">Za mało punktów do wykresu.</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                <XAxis dataKey="x" type="category" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="y" type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `${(v as number).toFixed(2).replace('.', ',')}`} domain={['auto', 'auto']} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    const d = payload?.[0]?.payload as typeof scatterData[0] | undefined
                    if (!d) return null
                    return (
                      <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow dark:border-gray-700 dark:bg-gray-900">
                        <p className="font-medium">{d.x}</p>
                        <p>{fmtPrice(d.y)} · {d.qty} szt. · {d.store}</p>
                      </div>
                    )
                  }}
                />
                <Scatter data={scatterData} fill="#4f46e5" opacity={0.85} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Zamówienia źródłowe ({uniqueOrders.length})
          </p>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {uniqueOrders.map(o => (
              <div key={o.orderRef}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-100 dark:border-gray-800 px-2.5 py-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <StoreBadge store={o.store} />
                  <span className="text-gray-700 dark:text-gray-300">{o.date}</span>
                  <span className="text-gray-400 dark:text-gray-500 font-mono text-[10px]">{o.orderRef}</span>
                </div>
                <span className="font-medium tabular-nums text-gray-800 dark:text-gray-200">{fmtPrice(o.unitPrice)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export function BasketPage() {
  const basketItems = useStore(s => s.basketItems)
  const priceObservations = useStore(s => s.priceObservations)
  const basketConfig = useStore(s => s.basketConfig)
  const setItemTracked = useStore(s => s.setItemTracked)
  const setBasketConfig = useStore(s => s.setBasketConfig)
  const mergeBasketItems = useStore(s => s.mergeBasketItems)
  const removeBasketItem = useStore(s => s.removeBasketItem)
  const updateBasketItem = useStore(s => s.updateBasketItem)

  const [showImport, setShowImport] = useState(false)
  const [sort, setSort] = useState<Sort>({ key: 'name', dir: 'asc' })
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  // Jednorazowe pozycje (1 obserwacja) zaśmiecają listę i nie dają porównań cen —
  // domyślnie ukryte, przełącznik w nagłówku karty.
  const [hideSingletons, setHideSingletons] = useState(true)
  const [page, setPage] = useState(0)

  const cpiSeries = useMemo(
    () => personalCpiSeries(basketItems, priceObservations, basketConfig),
    [basketItems, priceObservations, basketConfig],
  )
  const yoy = useMemo(() => cpiYoY(cpiSeries), [cpiSeries])
  const movers = useMemo(
    () => topMovers(basketItems, priceObservations, basketConfig, 5),
    [basketItems, priceObservations, basketConfig],
  )
  const allRows = useMemo(() => buildRows(basketItems, priceObservations), [basketItems, priceObservations])
  const sortedRows = useMemo(() => applySort(allRows, sort), [allRows, sort])

  const singletonCount = useMemo(() => allRows.filter(r => r.obsCount <= 1).length, [allRows])
  const visibleRows = useMemo(
    () => hideSingletons ? sortedRows.filter(r => r.obsCount > 1) : sortedRows,
    [sortedRows, hideSingletons],
  )

  // Pagination
  const PAGE_SIZE = 25
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pagedRows = useMemo(
    () => visibleRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [visibleRows, safePage],
  )

  const trackedCount = basketItems.filter(i => i.tracked).length

  const dateRange = useMemo(() => {
    if (priceObservations.length === 0) return null
    const dates = priceObservations.map(o => o.date).sort()
    return { from: dates[0], to: dates.at(-1)! }
  }, [priceObservations])

  const earliestMonth = useMemo(() => {
    if (priceObservations.length === 0) return undefined
    return priceObservations.map(o => monthOf(o.date)).sort()[0]
  }, [priceObservations])

  const chartData = useMemo(() => {
    const gus = basketConfig.officialCpi ?? []
    const months = new Set([...cpiSeries.map(p => p.month), ...gus.map(p => p.month)])
    const allMonths = [...months].sort()
    const personalByMonth = new Map(cpiSeries.map(p => [p.month, p.valuePct]))
    const gusByMonth = new Map(gus.map(p => [p.month, p.valuePct]))
    return allMonths.map(month => ({
      month,
      personal: personalByMonth.get(month),
      gus: gusByMonth.get(month),
    }))
  }, [cpiSeries, basketConfig.officialCpi])

  const hasGus = (basketConfig.officialCpi ?? []).length > 0
  const showChart = chartData.length >= 2

  const handleSort = (key: SortKey) => {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
    setPage(0)
  }

  const toggleSingletons = () => {
    setHideSingletons(v => !v)
    setPage(0)
  }

  const basketTableAction = singletonCount > 0 ? (
    <button
      type="button"
      onClick={toggleSingletons}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      title={hideSingletons ? 'Pokaż pozycje z jedną obserwacją' : 'Ukryj pozycje z jedną obserwacją'}
    >
      {hideSingletons ? <Eye size={13} /> : <EyeOff size={13} />}
      {hideSingletons ? `Pokaż jednorazowe (${singletonCount})` : 'Ukryj jednorazowe'}
    </button>
  ) : undefined

  const handleRemove = (id: string) => {
    removeBasketItem(id)
    setSelectedItemId(null)
  }

  const handleMerge = (targetId: string, sourceId: string) => {
    mergeBasketItems(targetId, sourceId)
    setSelectedItemId(null)
  }

  const importButton = (
    <button type="button" onClick={() => setShowImport(true)}
      className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm">
      <FileUp size={15} />Import .eml
    </button>
  )

  // empty state
  if (basketItems.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="Koszyk inflacyjny" description="Osobisty wskaźnik inflacji z potwierdzeń zamówień Frisco i Lisek." icon={ShoppingBasket} accent="assets" action={importButton} />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 py-16 text-center">
          <ShoppingBasket size={36} className="text-gray-300 dark:text-gray-600" />
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Brak danych koszyka</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Wgraj pliki .eml z potwierdzeniami Frisco lub Lisek, żeby zbudować własny CPI.</p>
          </div>
          <button type="button" onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-950 hover:bg-gray-800 dark:hover:bg-white">
            <FileUp size={15} />Import plików .eml
          </button>
        </div>
        {showImport && <ImportEmailsDialog onClose={() => setShowImport(false)} />}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Koszyk inflacyjny" description="Osobisty wskaźnik inflacji z potwierdzeń zamówień Frisco i Lisek." icon={ShoppingBasket} accent="assets" action={importButton} />

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="CPI rok do roku"
          value={yoy !== undefined ? fmtPct(yoy) : '—'}
          detail={cpiSeries.length > 0 ? `${cpiSeries[0].month} → ${cpiSeries.at(-1)!.month}` : 'Za mało danych'}
          tone={yoy !== undefined && yoy > 0 ? 'negative' : yoy !== undefined && yoy < 0 ? 'positive' : 'neutral'}
        />
        <StatCard label="Produkty śledzone" value={String(trackedCount)} detail={`z ${basketItems.length} łącznie (próg: ${basketConfig.trackingThreshold} obs.)`} tone="neutral" />
        <StatCard label="Obserwacje cen" value={String(priceObservations.length)} detail={dateRange ? `${dateRange.from} – ${dateRange.to}` : '—'} tone="neutral" />
        <StatCard label="Miesiące danych" value={String(new Set(priceObservations.map(o => monthOf(o.date))).size)} detail={basketConfig.method === 'laspeyres' ? 'Indeks Laspeyresa' : 'Wagi wydatkowe'} tone="neutral" />
      </div>

      {/* CPI chart */}
      {showChart && (
        <SectionCard title="Twój CPI" description={hasGus ? 'Porównanie z nakładką GUS (linia przerywana).' : 'Zmiana cen koszyka względem okresu bazowego.'} icon={TrendingUp} accent="assets">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `${(v as number) >= 0 ? '+' : ''}${(v as number).toFixed(1)}%`} />
              <Tooltip
                content={({ payload, label }) => {
                  if (!payload?.length) return null
                  return (
                    <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow dark:border-gray-700 dark:bg-gray-900">
                      <p className="font-medium mb-1">{label as string}</p>
                      {payload.map(p => (
                        <p key={String(p.dataKey)} className={p.dataKey === 'gus' ? 'text-amber-600 dark:text-amber-400' : pctTone(p.value as number | undefined)}>
                          {p.dataKey === 'gus' ? 'GUS r/r: ' : 'Mój CPI: '}{fmtPct(p.value as number | undefined)}
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              {hasGus && <Legend wrapperStyle={{ fontSize: 11 }} />}
              <Line type="monotone" dataKey="personal" name="Mój CPI" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3, fill: '#4f46e5' }} activeDot={{ r: 5 }} connectNulls />
              {hasGus && <Line type="monotone" dataKey="gus" name="GUS r/r" stroke="#d97706" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#d97706' }} activeDot={{ r: 5 }} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* Top movers */}
      {movers.length > 0 && (
        <SectionCard title="Top movers" description="Produkty z największym wpływem na wzrost indeksu." icon={TrendingUp} accent="assets">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {movers.map(m => (
              <button key={m.itemId} type="button"
                onClick={() => setSelectedItemId(prev => prev === m.itemId ? null : m.itemId)}
                className={`rounded-xl border p-3 text-left transition-colors ${selectedItemId === m.itemId ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.displayName}</p>
                <p className={`mt-1 text-base font-semibold tabular-nums ${pctTone(m.priceChangePct)}`}>{fmtPct(m.priceChangePct)}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">wkład {m.contributionPct >= 0 ? '+' : ''}{m.contributionPct.toFixed(2)} pp</p>
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Config panel */}
      <BasketConfigPanel config={basketConfig} onChange={setBasketConfig} earliestMonth={earliestMonth} />

      {/* Basket table */}
      <SectionCard title="Produkty w koszyku" icon={ShoppingBasket} accent="assets" action={basketTableAction}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="py-2 pl-2 w-5" aria-label="Waga" />
                <SortTh label="Produkt" sortKey="name" sort={sort} onSort={handleSort} align="left" className="min-w-[180px]" />
                <th className="py-2 px-2 text-xs text-gray-500 dark:text-gray-400 font-medium text-left">Sklep</th>
                <SortTh label="Cena/opak." sortKey="lastPrice" sort={sort} onSort={handleSort} />
                <SortTh label="Cena/kg|l" sortKey="pricePerKg" sort={sort} onSort={handleSort} />
                <SortTh label="Δ base" sortKey="deltaBase" sort={sort} onSort={handleSort} />
                <SortTh label="Δ ost." sortKey="deltaLast" sort={sort} onSort={handleSort} />
                <th className="py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium text-right">Trend</th>
                <SortTh label="#obs" sortKey="obsCount" sort={sort} onSort={handleSort} />
                <th className="py-2 pr-2 text-xs text-gray-500 dark:text-gray-400 font-medium text-right" aria-label="Śledź" />
              </tr>
            </thead>
            <tbody>
              {pagedRows.map(row => {
                const selected = selectedItemId === row.item.id
                return (
                  <Fragment key={row.item.id}>
                    <tr
                      onClick={() => setSelectedItemId(prev => prev === row.item.id ? null : row.item.id)}
                      className={`cursor-pointer border-b border-gray-50 dark:border-gray-800/50 transition-colors ${selected ? 'bg-indigo-50/60 dark:bg-indigo-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'}`}>
                      <td className="pl-2 py-2.5 text-center">
                        {priceObservations.some(o => o.itemId === row.item.id && o.isWeightItem) && (
                          <Scale size={12} className="text-amber-500" />
                        )}
                      </td>
                      <td className="pl-3 py-2.5">
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-tight">
                          {row.item.displayName}
                          {row.item.packageSize && (
                            <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">{row.item.packageSize}{row.item.unit}</span>
                          )}
                        </p>
                        {row.item.brand && <p className="text-[11px] text-gray-400 dark:text-gray-500">{row.item.brand}</p>}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex gap-0.5">{row.stores.map(s => <StoreBadge key={s} store={s} />)}</div>
                      </td>
                      <td className="pr-3 py-2.5 text-right tabular-nums text-xs text-gray-700 dark:text-gray-200">{fmtPrice(row.lastPrice)}</td>
                      <td className="pr-3 py-2.5 text-right tabular-nums text-xs text-gray-500 dark:text-gray-400">
                        {row.lastPricePerKg !== undefined ? fmtPrice(row.lastPricePerKg) + '/kg' : '—'}
                      </td>
                      <td className={`pr-3 py-2.5 text-right tabular-nums text-xs font-medium ${pctTone(row.deltaBase)}`}>{fmtPct(row.deltaBase)}</td>
                      <td className={`pr-3 py-2.5 text-right tabular-nums text-xs font-medium ${pctTone(row.deltaLast)}`}>{fmtPct(row.deltaLast)}</td>
                      <td className="pr-3 py-2.5 text-right"><Sparkline points={row.trendPoints} /></td>
                      <td className="pr-3 py-2.5 text-right tabular-nums text-xs text-gray-500 dark:text-gray-400">{row.obsCount}</td>
                      <td className="pr-2 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                        <button type="button"
                          onClick={() => setItemTracked(row.item.id, row.item.tracked ? false : null)}
                          title={row.item.tracked ? 'Śledzone — kliknij, żeby pominąć' : 'Pomijane — kliknij, żeby śledzić'}
                          className={`p-1 rounded transition-colors ${row.item.tracked ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20' : 'text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                          {row.item.tracked ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      </td>
                    </tr>

                    {selected && (
                      <tr key={`${row.item.id}-drill`}>
                        <td colSpan={10} className="p-2">
                          <DrillDown
                            row={row}
                            observations={priceObservations}
                            allItems={basketItems}
                            onClose={() => setSelectedItemId(null)}
                            onUpdate={patch => updateBasketItem(row.item.id, patch)}
                            onMerge={sourceId => handleMerge(row.item.id, sourceId)}
                            onRemove={() => handleRemove(row.item.id)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {visibleRows.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {hideSingletons && singletonCount > 0
                ? `Wszystkie pozycje mają tylko jedną obserwację — kliknij „Pokaż jednorazowe (${singletonCount})", aby je wyświetlić.`
                : 'Brak produktów.'}
            </p>
          )}
        </div>

        {pageCount > 1 && (
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="tabular-nums">
              Pozycje {safePage * PAGE_SIZE + 1}–{Math.min(visibleRows.length, safePage * PAGE_SIZE + PAGE_SIZE)} z {visibleRows.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft size={13} />Poprzednia
              </button>
              <span className="px-2 tabular-nums">{safePage + 1} / {pageCount}</span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                Następna<ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {showImport && <ImportEmailsDialog onClose={() => setShowImport(false)} />}
    </div>
  )
}
