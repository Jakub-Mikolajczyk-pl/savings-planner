// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BankTransaction, Category, CycleLeakAnalysis, PayPeriod } from '../../domain/types'
import { useStore } from '../../store'

vi.mock('../../config', () => ({
  IS_API_MODE: true,
}))

import { LeakAnalysisSection } from './LeakAnalysisSection'

const categories: Category[] = [
  { id: 1, name: 'Spożywcze', kind: 'variable', cashflowTreatment: 'expense' },
  { id: 2, name: 'Media', kind: 'fixed', cashflowTreatment: 'expense' },
]

const selectedPeriod: PayPeriod = {
  periodNo: 7,
  accountId: 'main',
  accountName: 'Konto główne',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  anchorTxId: 10,
  isPartial: false,
  income: 12000,
  expense: 6500,
  net: 5500,
}

const baseAnalysis: CycleLeakAnalysis = {
  periodNo: 7,
  accountId: 'main',
  accountName: 'Konto główne',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  isPartial: false,
  income: 12000,
  expense: 6500,
  net: 5500,
  topCategories: [],
  recurring: [],
  microExpenses: [],
  deltas: [],
}

function seedLeakAnalysisState({
  analysis,
  transactions,
}: {
  analysis: CycleLeakAnalysis
  transactions: BankTransaction[]
}) {
  useStore.setState({
    categories,
    leakAnalysis: analysis,
    cycleTransactions: transactions,
    cycleTransactionsPeriod: { accountId: selectedPeriod.accountId, periodNo: selectedPeriod.periodNo },
    loadLeakAnalysis: vi.fn().mockResolvedValue(undefined),
    loadCycleTransactions: vi.fn().mockResolvedValue(undefined),
    overrideTransactionCategory: vi.fn().mockResolvedValue(undefined),
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useStore.getState().resetAll()
})

beforeEach(() => {
  useStore.getState().resetAll()
})

describe('LeakAnalysisSection', () => {
  it('opens category details with only the clicked category transactions', () => {
    seedLeakAnalysisState({
      analysis: {
        ...baseAnalysis,
        topCategories: [
          {
            categoryId: 1,
            categoryName: 'Spożywcze',
            categoryKind: 'variable',
            cashflowTreatment: 'expense',
            amount: -220,
            income: 0,
            expense: 220,
            savingsContribution: 0,
            savingsWithdrawal: 0,
            transactionCount: 2,
          },
          {
            categoryId: 2,
            categoryName: 'Media',
            categoryKind: 'fixed',
            cashflowTreatment: 'expense',
            amount: -180,
            income: 0,
            expense: 180,
            savingsContribution: 0,
            savingsWithdrawal: 0,
            transactionCount: 1,
          },
        ],
      },
      transactions: [
        {
          id: 101,
          accountId: 'main',
          bookedAt: '2026-06-12',
          amount: -120,
          currency: 'PLN',
          description: 'Zakupy tygodniowe',
          counterparty: 'Biedronka',
          source: 'manual',
          categoryId: 1,
          categoryLocked: false,
        },
        {
          id: 102,
          accountId: 'main',
          bookedAt: '2026-06-20',
          amount: -100,
          currency: 'PLN',
          description: 'Warzywa i owoce',
          counterparty: 'Lidl',
          source: 'manual',
          categoryId: 1,
          categoryLocked: true,
        },
        {
          id: 103,
          accountId: 'main',
          bookedAt: '2026-06-08',
          amount: -180,
          currency: 'PLN',
          description: 'Prąd',
          counterparty: 'PGE',
          source: 'manual',
          categoryId: 2,
          categoryLocked: true,
        },
      ],
    })

    render(<LeakAnalysisSection selectedPeriod={selectedPeriod} />)

    fireEvent.click(screen.getByRole('button', { name: /spożywcze/i }))

    expect(screen.queryByText('Biedronka')).not.toBeNull()
    expect(screen.queryByText('Lidl')).not.toBeNull()
    expect(screen.queryByText('PGE')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /zamknij/i }))

    expect(screen.queryByRole('button', { name: /zamknij/i })).toBeNull()
  })

  it('supports drilldown for uncategorized top-category rows', () => {
    seedLeakAnalysisState({
      analysis: {
        ...baseAnalysis,
        topCategories: [
          {
            categoryId: undefined,
            categoryName: 'Bez kategorii',
            categoryKind: undefined,
            cashflowTreatment: 'expense',
            amount: -90,
            income: 0,
            expense: 90,
            savingsContribution: 0,
            savingsWithdrawal: 0,
            transactionCount: 1,
          },
        ],
      },
      transactions: [
        {
          id: 201,
          accountId: 'main',
          bookedAt: '2026-06-14',
          amount: -90,
          currency: 'PLN',
          description: 'Nieopisany zakup',
          counterparty: 'Sklep osiedlowy',
          source: 'manual',
          categoryId: undefined,
          categoryLocked: false,
        },
        {
          id: 202,
          accountId: 'main',
          bookedAt: '2026-06-15',
          amount: -40,
          currency: 'PLN',
          description: 'Przypisana płatność',
          counterparty: 'Rossmann',
          source: 'manual',
          categoryId: 1,
          categoryLocked: true,
        },
      ],
    })

    render(<LeakAnalysisSection selectedPeriod={selectedPeriod} />)

    fireEvent.click(screen.getByRole('button', { name: /bez kategorii/i }))

    expect(screen.queryByText('Sklep osiedlowy')).not.toBeNull()
    expect(screen.queryByText('Rossmann')).toBeNull()
  })
})
