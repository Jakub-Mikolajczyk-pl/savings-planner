import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { buildSecurityBuffers } from '../../domain/securityBuffers'
import { formatPLN, formatYearMonth } from '../../domain/formatting'
import type { Schedule } from '../../domain/types'
import { useStore } from '../../store'

export function SecurityBufferFocus({ schedule }: { schedule: Schedule }) {
  const settings = useStore(s => s.settings)
  const accounts = useStore(s => s.accounts)
  const snapshots = useStore(s => s.accountSnapshots)
  const model = buildSecurityBuffers(settings, accounts, snapshots, schedule)
  const needsFocus = model.missingBuffers.length > 0
  const Icon = needsFocus ? ShieldAlert : ShieldCheck

  if (!model.latestMonth) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Brak snapshotów kont. Poduszka i fundusz awaryjny pojawią się w Planie po uzupełnieniu Majątku.
      </div>
    )
  }

  return (
    <div className={`rounded-md border px-4 py-4 ${
      needsFocus
        ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/70 dark:bg-amber-950/20'
        : 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/70 dark:bg-emerald-950/20'
    }`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon size={18} className={needsFocus ? 'mt-0.5 text-amber-600 dark:text-amber-300' : 'mt-0.5 text-emerald-600 dark:text-emerald-300'} />
          <div>
            <h3 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
              {needsFocus ? 'Priorytet 1: odbuduj bezpieczeństwo' : 'Bezpieczeństwo finansowe domknięte'}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {needsFocus
                ? 'Elo mordo, na tym trzeba się skupić dla spokoju ducha i rodziny zanim gonimy mniej krytyczne cele.'
                : 'Poduszka i fundusz awaryjny są powyżej celu. Można spokojniej patrzeć na kolejne cele.'}
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
          <p>Snapshot {formatYearMonth(model.latestMonth)}</p>
          <p>Baza kosztów {formatPLN(model.monthlyCostBasis)}/mies.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {model.buffers.map(buffer => (
          <div key={buffer.id} className="rounded-md border border-white/70 bg-white/70 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{buffer.title}</p>
                  {buffer.status === 'missing' && (
                    <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      Priorytet 1
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400" title={buffer.detail}>{buffer.detail}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{buffer.progressPct}%</p>
                <p className={buffer.status === 'missing' ? 'text-xs tabular-nums text-amber-700 dark:text-amber-300' : 'text-xs text-emerald-700 dark:text-emerald-300'}>
                  {buffer.status === 'missing' ? `brakuje ${formatPLN(buffer.missing)}` : 'cel osiągnięty'}
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800">
              <div
                className={`h-full rounded-sm ${buffer.status === 'missing' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${buffer.progressPct}%` }}
              />
            </div>
            <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {formatPLN(buffer.current)} / {formatPLN(buffer.target)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
