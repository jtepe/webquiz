import type { AuthMode, ConnectionStatus, GameSession, LobbyGame } from '../types'

export type BackendEvent =
  | {
      type: 'connection.status'
      status: ConnectionStatus
    }
  | {
      type: 'auth.ready'
      playerId: string
      authMode: AuthMode
    }
  | {
      type: 'lobby.snapshot'
      games: LobbyGame[]
    }
  | {
      type: 'session.sync'
      session: GameSession | null
    }
  | {
      type: 'local.answer.selected'
      answerId: string | null
    }
  | {
      type: 'error'
      message: string
    }

export type BackendTransport = {
  connect: () => void
  disconnect: () => void
  subscribe: (listener: (event: BackendEvent) => void) => () => void
  enterGuest: (displayName: string) => void
  startOidc: () => void
  subscribeLobby: () => void
  createGame: (topic: string, questionCount: number) => void
  joinGame: (gameId: string) => void
  submitAnswer: (gameId: string, questionId: string, answerId: string) => void
  readyForNext: (gameId: string, questionId: string) => void
  returnToLobby: (gameId: string) => void
}
