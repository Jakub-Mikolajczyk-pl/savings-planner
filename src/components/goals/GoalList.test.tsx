// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useStore } from '../../store'
import { GoalList } from './GoalList'

afterEach(() => {
  cleanup()
  useStore.getState().resetAll()
})

describe('GoalList', () => {
  it('keeps long goal metadata wrap-friendly on narrow layouts', () => {
    useStore.setState({
      goals: [
        {
          id: 'goal-1',
          name: 'Bardzo długi cel z nazwą, która wcześniej rozpychała cały wiersz',
          targetAmount: 120000,
          deadline: '2026-12-31',
          priority: 1,
          fixedAllocation: 1500,
        },
      ],
    })

    render(<GoalList />)

    const goalName = screen.getByText('Bardzo długi cel z nazwą, która wcześniej rozpychała cały wiersz')
    expect(goalName.className).toContain('min-w-0')

    const metadataRow = screen.getByText(/termin:/i).parentElement
    expect(metadataRow?.className).toContain('flex-wrap')
  })
})
