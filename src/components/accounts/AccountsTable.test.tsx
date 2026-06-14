// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store'
import { AccountsTable } from './AccountsTable'

afterEach(() => {
  cleanup()
  useStore.getState().resetAll()
})

describe('AccountsTable', () => {
  it('exposes a month-level remove action from the sticky month column', () => {
    const onRemoveMonth = vi.fn()

    render(
      <AccountsTable
        accounts={[{ id: 'main', name: 'Konto osobiste', bucket: 'accounts', currency: 'PLN' }]}
        snapshots={[{ accountId: 'main', yearMonth: '2026-06', balance: 1000 }]}
        months={['2026-06']}
        onSetSnapshot={vi.fn()}
        onRemoveSnapshot={vi.fn()}
        onRemoveMonth={onRemoveMonth}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Usuń miesiąc 2026-06' }))

    expect(onRemoveMonth).toHaveBeenCalledWith('2026-06')
  })
})
