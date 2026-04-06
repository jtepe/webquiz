import { describe, expect, it } from 'vitest'
import { createMockTransport } from './mockTransport'
import type { BackendEvent } from './transport'

describe('createMockTransport', () => {
  it('treats a joined guest as player two', () => {
    const transport = createMockTransport()
    const events: BackendEvent[] = []

    transport.subscribe((event) => {
      events.push(event)
    })

    transport.identifyPlayer('Guest')
    transport.joinGame('game-101')

    const authEvents = events.filter((event) => event.type === 'auth.ready')
    expect(authEvents.at(-1)).toEqual({
      type: 'auth.ready',
      playerId: 'player_2',
    })

    const sessionEvent = events.findLast((event) => event.type === 'session.sync')
    expect(sessionEvent?.type).toBe('session.sync')
    if (sessionEvent?.type !== 'session.sync' || !sessionEvent.session) {
      return
    }

    expect(sessionEvent.session.players[0].name).toBe('Mira')
    expect(sessionEvent.session.players[1].name).toBe('Guest')
  })
})
