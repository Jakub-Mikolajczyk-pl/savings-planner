import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Accent = 'assets' | 'plan' | 'settings' | 'overview'
type Tone = 'neutral' | 'positive' | 'negative' | 'asset' | 'plan'

interface PageHeaderProps {
  title: string
  description: string
  icon: LucideIcon
  accent?: Accent
  action?: ReactNode
}

interface SectionCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  accent?: Accent
  action?: ReactNode
  children: ReactNode
  className?: string
}

interface StatCardProps {
  label: string
  value: string
  detail?: string
  tone?: Tone
}

// Tinted "chip" pod ikoną — delikatny akcent domenowy, nie krzykliwe tło całej karty.
const accentChip: Record<Accent, string> = {
  overview: 'bg-stone-200/60 text-stone-700 dark:bg-stone-700/40 dark:text-stone-200',
  assets: 'bg-teal-100/70 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  plan: 'bg-indigo-100/70 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  settings: 'bg-amber-100/70 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

const toneText: Record<Tone, string> = {
  neutral: 'text-gray-900 dark:text-gray-50',
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-600 dark:text-rose-400',
  asset: 'text-teal-700 dark:text-teal-300',
  plan: 'text-indigo-700 dark:text-indigo-300',
}

// Wspólna „powierzchnia" karty: subtelna głębia (cień + ring) zamiast płaskiej kreski.
export const surface =
  'rounded-2xl border border-gray-200/70 bg-white/90 shadow-[0_1px_2px_rgba(16,17,19,0.04),0_10px_30px_-18px_rgba(16,17,19,0.18)] ring-1 ring-black/[0.02] ' +
  'dark:border-gray-800/80 dark:bg-gray-900/60 dark:ring-white/[0.04]'

export function PageHeader({ title, description, icon: Icon, accent = 'overview', action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl ${accentChip[accent]}`}>
          <Icon size={18} />
        </span>
        <div>
          <h1 className="font-display text-[1.65rem] font-semibold leading-tight tracking-tight text-gray-950 dark:text-gray-50">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  accent = 'overview',
  action,
  children,
  className = '',
}: SectionCardProps) {
  return (
    <section className={`${surface} p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon && (
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${accentChip[accent]}`}>
              <Icon size={16} />
            </span>
          )}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function StatCard({ label, value, detail, tone = 'neutral' }: StatCardProps) {
  return (
    <div className={`${surface} p-4`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-2 font-display text-[1.7rem] font-semibold leading-none tnum ${toneText[tone]}`}>{value}</p>
      {detail && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{detail}</p>}
    </div>
  )
}
