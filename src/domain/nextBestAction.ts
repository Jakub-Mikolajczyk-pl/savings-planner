import { summarizeIkzePlans } from './ikze'
import type { NextCycleForecast } from './nextCycleForecast'
import type { SecurityBuffersModel } from './securityBuffers'
import type { Goal, Settings } from './types'

export type NextBestActionKind =
  | 'cover_deficit'
  | 'top_up_security_buffer'
  | 'fund_ikze'
  | 'fund_goal'
  | 'hold_surplus'

export type NextBestActionConfidence = 'high' | 'medium' | 'low'

export interface NextBestAction {
  kind: NextBestActionKind
  title: string
  amount: number
  targetId?: string
  targetName?: string
  confidence: NextBestActionConfidence
  reasons: string[]
  effects: string[]
  source: 'algorithm'
}

export interface NextBestActionInput {
  forecast: NextCycleForecast
  security: SecurityBuffersModel
  settings: Settings
  goals: Goal[]
}

export interface RecommendationNarratorInput {
  action: NextBestAction
}

export type RecommendationNarrator = (input: RecommendationNarratorInput) => string | Promise<string>

export function buildNextBestAction({
  forecast,
  security,
  settings,
  goals,
}: NextBestActionInput): NextBestAction {
  const available = roundMoney(forecast.freeCashAfterCreditCard)

  if (available < 0) {
    const deficit = Math.abs(available)
    return {
      kind: 'cover_deficit',
      title: 'Domknij deficyt następnego cyklu',
      amount: deficit,
      confidence: 'high',
      reasons: [
        'Następny cykl jest pod kreską po kosztach i spłacie karty.',
        'Dopóki deficyt nie jest pokryty, nowe oszczędzanie zwiększa ryzyko cashflow.',
      ],
      effects: [
        `Do zabezpieczenia brakuje ${formatAmount(deficit)}.`,
        'Cele oszczędnościowe powinny poczekać do dodatniej wolnej gotówki.',
      ],
      source: 'algorithm',
    }
  }

  if (!security.latestMonth) {
    return {
      kind: 'hold_surplus',
      title: 'Uzupełnij snapshoty przed decyzją',
      amount: Math.max(available, 0),
      confidence: 'low',
      reasons: [
        'Brak snapshotów kont, więc silnik nie wie, czy fundusz awaryjny i poduszka są bezpieczne.',
      ],
      effects: [
        available > 0
          ? `Nadwyżka ${formatAmount(available)} zostaje dostępna do ręcznej decyzji po aktualizacji Majątku.`
          : 'Ten cykl nie ma wolnej gotówki do rozdysponowania.',
      ],
      source: 'algorithm',
    }
  }

  const missingSecurity = security.missingBuffers[0]
  if (missingSecurity && available > 0) {
    const amount = Math.min(available, missingSecurity.missing)
    return {
      kind: 'top_up_security_buffer',
      title: `Doładuj ${missingSecurity.title.toLowerCase()}`,
      amount,
      targetId: missingSecurity.goalId,
      targetName: missingSecurity.title,
      confidence: security.latestMonth ? 'high' : 'medium',
      reasons: [
        `${missingSecurity.title} jest poniżej celu o ${formatAmount(missingSecurity.missing)}.`,
        'Bezpieczeństwo finansowe ma priorytet przed IKZE i celami uznaniowymi.',
      ],
      effects: [
        amount >= missingSecurity.missing
          ? `${missingSecurity.title} zostanie domknięty.`
          : `${missingSecurity.title} zmniejszy lukę do ${formatAmount(missingSecurity.missing - amount)}.`,
        `Po ruchu zostanie ${formatAmount(Math.max(available - amount, 0))} wolnej gotówki w cyklu.`,
      ],
      source: 'algorithm',
    }
  }

  const ikze = summarizeIkzePlans(settings.ikzePlans ?? [])
  if (available > 0 && ikze.remaining > 0 && ikze.perPayout > 0) {
    const amount = Math.min(available, ikze.perPayout, ikze.remaining)
    return {
      kind: 'fund_ikze',
      title: 'Dopłać IKZE na ten cykl',
      amount,
      targetId: 'ikze',
      targetName: 'IKZE',
      confidence: 'medium',
      reasons: [
        `Bezpieczeństwo jest domknięte, a w IKZE zostało ${formatAmount(ikze.remaining)} limitu.`,
        `Rekomendowana wpłata na wypłatę wynosi ${formatAmount(ikze.perPayout)}.`,
      ],
      effects: [
        amount >= ikze.remaining
          ? 'Roczny limit IKZE zostanie domknięty.'
          : `Do limitu IKZE zostanie ${formatAmount(ikze.remaining - amount)}.`,
        `Po ruchu zostanie ${formatAmount(Math.max(available - amount, 0))} wolnej gotówki w cyklu.`,
      ],
      source: 'algorithm',
    }
  }

  const goal = nextManualGoal(goals)
  if (goal && available > 0) {
    const remaining = Math.max(goal.targetAmount - (goal.currentSaved ?? 0), 0)
    const amount = Math.min(available, remaining)
    return {
      kind: 'fund_goal',
      title: `Zasil cel: ${goal.name}`,
      amount,
      targetId: goal.id,
      targetName: goal.name,
      confidence: 'medium',
      reasons: [
        'Bezpieczeństwo i IKZE nie wymagają pilniejszego ruchu w tym cyklu.',
        `${goal.name} jest najwyżej w kolejce aktywnych celów.`,
      ],
      effects: [
        amount >= remaining
          ? `${goal.name} zostanie domknięty.`
          : `${goal.name} zmniejszy lukę do ${formatAmount(remaining - amount)}.`,
        `Po ruchu zostanie ${formatAmount(Math.max(available - amount, 0))} wolnej gotówki w cyklu.`,
      ],
      source: 'algorithm',
    }
  }

  return {
    kind: 'hold_surplus',
    title: 'Zostaw nadwyżkę jako bufor',
    amount: Math.max(available, 0),
    confidence: 'low',
    reasons: [
      'Nie ma pilnego deficytu, brakującego bufora bezpieczeństwa, aktywnego IKZE ani celu do zasilenia.',
    ],
    effects: [
      available > 0
        ? `Nadwyżka ${formatAmount(available)} zostaje dostępna na ręczną decyzję.`
        : 'Ten cykl nie ma wolnej gotówki do rozdysponowania.',
    ],
    source: 'algorithm',
  }
}

function nextManualGoal(goals: Goal[]): Goal | undefined {
  return goals
    .filter(goal => (goal.currentSaved ?? 0) < goal.targetAmount)
    .sort((a, b) =>
      a.priority - b.priority
      || (a.deadline ?? '9999-99-99').localeCompare(b.deadline ?? '9999-99-99')
      || a.name.localeCompare(b.name)
    )[0]
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function formatAmount(value: number): string {
  return `${roundMoney(value).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}
