// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Account, AccountSnapshot } from '../../domain/types'
import { DeleteSnapshotMonthDialog, SnapshotMonthDialog } from './SnapshotMonthDialog'

afterEach(() => {
  cleanup()
})

describe('SnapshotMonthDialog', () => {
  const accounts: Account[] = [
    { id: 'main', name: 'Konto osobiste', bucket: 'accounts', currency: 'PLN', openedAt: '2026-01' },
    { id: 'broker', name: 'Broker EUR', bucket: 'investments', currency: 'EUR', openedAt: '2026-01' },
    { id: 'future', name: 'Przyszłe konto', bucket: 'accounts', currency: 'PLN', openedAt: '2026-07' },
  ]

  const snapshots: AccountSnapshot[] = [
    { accountId: 'main', yearMonth: '2026-05', balance: 1000 },
    { accountId: 'broker', yearMonth: '2026-06', balance: 80 },
  ]

  it('saves balances for every active account in the selected month', () => {
    const onSave = vi.fn()

    render(
      <SnapshotMonthDialog
        accounts={accounts}
        snapshots={snapshots}
        yearMonth="2026-06"
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    )

    expect(screen.getByRole('dialog', { name: /salda kont/i })).toBeTruthy()
    expect(screen.getByText('Konto osobiste')).toBeTruthy()
    expect(screen.getByText('Broker EUR')).toBeTruthy()
    expect(screen.queryByText('Przyszłe konto')).toBeNull()

    fireEvent.change(screen.getByRole('textbox', { name: 'Konto osobiste' }), {
      target: { value: '1234,50' },
    })
    fireEvent.click(screen.getByRole('button', { name: /zapisz salda/i }))

    expect(onSave).toHaveBeenCalledWith([
      { accountId: 'main', yearMonth: '2026-06', balance: 1234.5 },
      { accountId: 'broker', yearMonth: '2026-06', balance: 80 },
    ])
  })
})

describe('DeleteSnapshotMonthDialog', () => {
  it('warns before removing a month', () => {
    const onConfirm = vi.fn()

    render(
      <DeleteSnapshotMonthDialog
        yearMonth="2026-06"
        snapshotCount={3}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('dialog', { name: /usunąć miesiąc/i })).toBeTruthy()
    expect(screen.getByText(/3 snapshot/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Usuń miesiąc' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
