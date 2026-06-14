// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store'
import { LoanList } from './LoanList'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  useStore.getState().resetAll()
})

describe('LoanList', () => {
  it('locks the paid button and confirms the installment update', () => {
    vi.useFakeTimers()
    useStore.setState({
      loans: [
        {
          id: 'loan-1',
          name: 'Auto',
          remainingBalance: 1500,
          monthlyPayment: 1000,
        },
      ],
    })

    render(<LoanList />)

    const paidButton = screen.getByRole('button', { name: /oznacz rat/i }) as HTMLButtonElement
    fireEvent.click(paidButton)

    const updatingButton = screen.getByRole('button', { name: /aktualiz/i }) as HTMLButtonElement
    expect(updatingButton.disabled).toBe(true)
    expect(updatingButton.textContent).toContain('Aktualiz')
    expect(useStore.getState().loans[0].remainingBalance).toBe(500)
    const loanDetails = screen.getByText('Auto').nextElementSibling
    expect(loanDetails?.textContent).toContain('500,00')
    expect(loanDetails?.textContent).toContain('/mies')

    act(() => {
      vi.advanceTimersByTime(180)
    })

    const savedButton = screen.getByRole('button', { name: /rata zapisana/i }) as HTMLButtonElement
    expect(savedButton.disabled).toBe(true)
    expect(savedButton.textContent).toContain('Zapisano')

    act(() => {
      vi.advanceTimersByTime(900)
    })

    const nextPaidButton = screen.getByRole('button', { name: /oznacz rat/i }) as HTMLButtonElement
    expect(nextPaidButton.disabled).toBe(false)
    expect(nextPaidButton.getAttribute('aria-label')).toContain('500,00')
  })
})
