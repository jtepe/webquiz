import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

describe('App', () => {
  it('renders the landing screen', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        name: /fast rounds, locked answers, clean scorekeeping/i,
      }),
    ).toBeInTheDocument()
  })

  it('defaults the lobby question count selection to 3', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'Jonas' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enter lobby/i }))

    expect(
      await screen.findByRole('heading', {
        name: /jonas, pick your next match\./i,
      }),
    ).toBeInTheDocument()

    expect(screen.getByLabelText(/questions/i)).toHaveValue('3')
  })
})
