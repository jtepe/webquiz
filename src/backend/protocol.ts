import type { LobbyGame, Player, Question } from '../types'

export type ClientMessage =
  | {
      type: 'session.hello'
      requestId: string
      payload: {
        protocolVersion: 1
        clientVersion: string
        resumeToken: string | null
      }
    }
  | {
      type: 'player.identify'
      requestId: string
      payload: {
        displayName: string
      }
    }
  | {
      type: 'lobby.subscribe'
      requestId: string
      payload: Record<string, never>
    }
  | {
      type: 'game.create'
      requestId: string
      payload: {
        topic: string
        questionCount: number
      }
    }
  | {
      type: 'game.join'
      requestId: string
      payload: {
        gameId: string
      }
    }
  | {
      type: 'answer.submit'
      requestId: string
      payload: {
        gameId: string
        questionId: string
        answerId: string
      }
    }
  | {
      type: 'question.next.ready'
      requestId: string
      payload: {
        gameId: string
        questionId: string
      }
    }
  | {
      type: 'lobby.return'
      requestId: string
      payload: {
        gameId: string
      }
    }

export type GameSnapshotPayload = {
  game: {
    id: string
    topic: string
    questionCount: number
    questionIndex: number
    phase: 'waiting_for_player' | 'question_active' | 'answer_reveal' | 'waiting_for_next' | 'results'
    players: Player[]
  }
}

export type ServerMessage =
  | {
      type: 'session.ready'
      requestId?: string
      payload: {
        playerId: string
      }
    }
  | {
      type: 'lobby.snapshot'
      requestId?: string
      payload: {
        games: LobbyGame[]
      }
    }
  | ({ type: 'game.created' | 'game.joined'; requestId?: string } & {
      payload: GameSnapshotPayload
    })
  | {
      type: 'game.player_joined'
      requestId?: string
      payload: {
        gameId: string
        player: {
          id: string
          name: string
        }
      }
    }
  | {
      type: 'question.started'
      requestId?: string
      payload: {
        gameId: string
        questionIndex: number
        questionCount: number
        questionEndsAt: string
        question: Question
        players: Player[]
      }
    }
  | {
      type: 'answer.accepted'
      requestId?: string
      payload: {
        gameId: string
        questionId: string
        playerId: string
        locked: true
      }
    }
  | {
      type: 'answer.locked'
      requestId?: string
      payload: {
        gameId: string
        questionId: string
        playerId: string
      }
    }
  | {
      type: 'question.revealed'
      requestId?: string
      payload: {
        gameId: string
        questionId: string
        correctAnswerId: string
        players: Player[]
        reason: 'both_answered' | 'time_expired'
      }
    }
  | {
      type: 'question.next.waiting'
      requestId?: string
      payload: {
        gameId: string
        questionId: string
        players: Player[]
      }
    }
  | {
      type: 'game.results'
      requestId?: string
      payload: {
        gameId: string
        players: Player[]
        winnerPlayerId: string | null
        winnerLabel: string
      }
    }
  | {
      type: 'error'
      requestId?: string
      payload: {
        code: string
        message: string
      }
    }
