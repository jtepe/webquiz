import { describe, expect, it, vi } from 'vitest'
import { createWebSocketTransport } from './websocketTransport'
import type { BackendEvent } from './transport'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static OPEN = 1
  static CONNECTING = 0

  readyState = FakeWebSocket.CONNECTING
  sentMessages: string[] = []
  private listeners = new Map<string, Set<(event?: MessageEvent) => void>>()

  constructor(url: string) {
    void url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, listener: (event?: MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  send(message: string) {
    this.sentMessages.push(message)
  }

  close() {
    this.readyState = 3
  }

  emit(type: string, data?: unknown) {
    if (type === 'open') {
      this.readyState = FakeWebSocket.OPEN
    }

    const event =
      type === 'message'
        ? ({
            data: JSON.stringify(data),
          } as MessageEvent)
        : undefined

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

describe('createWebSocketTransport', () => {
  it('treats a joined client as the second player from the game snapshot', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)

    const transport = createWebSocketTransport('ws://example.test')
    const events: BackendEvent[] = []
    transport.subscribe((event) => {
      events.push(event)
    })

    transport.connect()

    const socket = FakeWebSocket.instances[0]
    socket.emit('open')
    socket.emit('message', {
      type: 'session.ready',
      payload: {
        playerId: 'connection-player',
      },
    })
    socket.emit('message', {
      type: 'game.joined',
      payload: {
        game: {
          id: 'game_42',
          topic: 'Science',
          questionCount: 12,
          questionIndex: 0,
          phase: 'question_active',
          players: [
            {
              id: 'player_1',
              name: 'Host',
              score: 0,
              isReadyForNext: false,
            },
            {
              id: 'player_2',
              name: 'Guest',
              score: 0,
              isReadyForNext: false,
            },
          ],
        },
      },
    })

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

    const localPlayer = sessionEvent.session.players.find((player) => player.id === 'player_2')
    expect(localPlayer?.name).toBe('Guest')
  })
})
