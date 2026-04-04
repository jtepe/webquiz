import type { ServerMessage, ClientMessage, GameSnapshotPayload } from './protocol'
import type { BackendEvent, BackendTransport } from './transport'
import type { GameSession, Player } from '../types'

export function createWebSocketTransport(url: string): BackendTransport {
  let socket: WebSocket | null = null
  const listeners = new Set<(event: BackendEvent) => void>()
  let queue: ClientMessage[] = []
  let requestCounter = 0
  let selfPlayerId: string | null = null
  let session: GameSession | null = null

  const emit = (event: BackendEvent) => {
    for (const listener of listeners) {
      listener(event)
    }
  }

  const nextRequestId = () => `req_${++requestCounter}`

  const sendMessage = (message: ClientMessage) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
      return
    }
    queue.push(message)
  }

  const flushQueue = () => {
    if (socket?.readyState !== WebSocket.OPEN) {
      return
    }
    for (const message of queue) {
      socket.send(JSON.stringify(message))
    }
    queue = []
  }

  const normalizePlayers = (players: Player[]): [Player, Player] => {
    if (players.length >= 2) {
      return [
        { ...players[0] },
        { ...players[1] },
      ]
    }
    return [
      { ...players[0] },
      {
        id: 'pending_player',
        name: 'Waiting for player two',
        score: 0,
        isReadyForNext: false,
        hasLockedAnswer: false,
      },
    ]
  }

  const mapSnapshot = (payload: GameSnapshotPayload): GameSession => ({
    id: payload.game.id,
    topic: payload.game.topic,
    totalQuestions: payload.game.questionCount,
    questionIndex: payload.game.questionIndex,
    phase: payload.game.phase,
    players: normalizePlayers(
      payload.game.players.map((player) => ({
        ...player,
        hasLockedAnswer: player.hasLockedAnswer ?? false,
      })),
    ),
    currentQuestion: null,
    correctAnswerId: null,
    questionEndsAt: null,
    resultMessage: null,
    winnerLabel: null,
  })

  const applyMessage = (message: ServerMessage) => {
    switch (message.type) {
      case 'session.ready':
        selfPlayerId = message.payload.playerId
        emit({
          type: 'auth.ready',
          playerId: message.payload.playerId,
          authMode: message.payload.authMode,
        })
        return
      case 'auth.oidc.pending':
        emit({ type: 'error', message: message.payload.message })
        return
      case 'lobby.snapshot':
        emit({ type: 'lobby.snapshot', games: message.payload.games })
        return
      case 'game.created':
      case 'game.joined':
        session = mapSnapshot(message.payload)
        emit({ type: 'local.answer.selected', answerId: null })
        emit({ type: 'session.sync', session })
        return
      case 'game.player_joined':
        if (!session || session.id !== message.payload.gameId) {
          return
        }
        session = {
          ...session,
          players: normalizePlayers(
            session.players.map((player) =>
              player.id === message.payload.player.id
                ? { ...player, name: message.payload.player.name }
                : player,
            ),
          ),
        }
        emit({ type: 'session.sync', session })
        return
      case 'question.started':
        if (!session || session.id !== message.payload.gameId) {
          return
        }
        session = {
          ...session,
          questionIndex: message.payload.questionIndex,
          totalQuestions: message.payload.questionCount,
          phase: 'question_active',
          currentQuestion: message.payload.question,
          correctAnswerId: null,
          questionEndsAt: message.payload.questionEndsAt,
          resultMessage: null,
          players: normalizePlayers(
            message.payload.players.map((player) => ({
              ...player,
              hasLockedAnswer: false,
              didAnswerCorrectly: undefined,
            })),
          ),
        }
        emit({ type: 'local.answer.selected', answerId: null })
        emit({ type: 'session.sync', session })
        return
      case 'answer.accepted':
        return
      case 'answer.locked':
        if (!session || session.id !== message.payload.gameId) {
          return
        }
        session = {
          ...session,
          players: normalizePlayers(
            session.players.map((player) =>
              player.id === message.payload.playerId
                ? { ...player, hasLockedAnswer: true }
                : player,
            ),
          ),
        }
        emit({ type: 'session.sync', session })
        return
      case 'question.revealed': {
        if (!session || session.id !== message.payload.gameId) {
          return
        }
        const localPlayer = message.payload.players.find((player) => player.id === selfPlayerId)
        const resultMessage =
          localPlayer?.didAnswerCorrectly === true
            ? 'Locked in and correct.'
            : 'Locked in, but not correct this round.'
        session = {
          ...session,
          phase: 'answer_reveal',
          correctAnswerId: message.payload.correctAnswerId,
          questionEndsAt: null,
          resultMessage:
            message.payload.reason === 'time_expired' && !localPlayer?.hasLockedAnswer
              ? 'Time ran out. Your answer counted as no answer.'
              : resultMessage,
          players: normalizePlayers(
            message.payload.players.map((player) => ({
              ...player,
              hasLockedAnswer: true,
            })),
          ),
        }
        emit({ type: 'session.sync', session })
        return
      }
      case 'question.next.waiting':
        if (!session || session.id !== message.payload.gameId) {
          return
        }
        session = {
          ...session,
          phase: 'waiting_for_next',
          players: normalizePlayers(
            message.payload.players.map((player) => ({
              ...player,
              hasLockedAnswer: true,
            })),
          ),
        }
        emit({ type: 'session.sync', session })
        return
      case 'game.results':
        if (!session || session.id !== message.payload.gameId) {
          return
        }
        session = {
          ...session,
          phase: 'results',
          winnerLabel: message.payload.winnerLabel,
          players: normalizePlayers(
            message.payload.players.map((player) => ({
              ...player,
              hasLockedAnswer: false,
            })),
          ),
        }
        emit({ type: 'session.sync', session })
        return
      case 'error':
        emit({ type: 'error', message: message.payload.message })
    }
  }

  return {
    connect() {
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return
      }
      emit({ type: 'connection.status', status: 'connecting' })
      socket = new WebSocket(url)
      socket.addEventListener('open', () => {
        emit({ type: 'connection.status', status: 'connected' })
        sendMessage({
          type: 'session.hello',
          requestId: nextRequestId(),
          payload: {
            protocolVersion: 1,
            clientVersion: 'webquiz-frontend',
            resumeToken: null,
          },
        })
        flushQueue()
      })
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data) as ServerMessage
        applyMessage(message)
      })
      socket.addEventListener('close', () => {
        emit({ type: 'connection.status', status: 'disconnected' })
      })
      socket.addEventListener('error', () => {
        emit({ type: 'error', message: 'WebSocket connection error.' })
      })
    },
    disconnect() {
      socket?.close()
      socket = null
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    enterGuest(displayName) {
      sendMessage({
        type: 'auth.guest.enter',
        requestId: nextRequestId(),
        payload: { displayName },
      })
    },
    startOidc() {
      sendMessage({
        type: 'auth.oidc.start',
        requestId: nextRequestId(),
        payload: {},
      })
    },
    subscribeLobby() {
      sendMessage({
        type: 'lobby.subscribe',
        requestId: nextRequestId(),
        payload: {},
      })
    },
    createGame(topic, questionCount) {
      sendMessage({
        type: 'game.create',
        requestId: nextRequestId(),
        payload: { topic, questionCount },
      })
    },
    joinGame(gameId) {
      sendMessage({
        type: 'game.join',
        requestId: nextRequestId(),
        payload: { gameId },
      })
    },
    submitAnswer(gameId, questionId, answerId) {
      emit({ type: 'local.answer.selected', answerId })
      sendMessage({
        type: 'answer.submit',
        requestId: nextRequestId(),
        payload: { gameId, questionId, answerId },
      })
    },
    readyForNext(gameId, questionId) {
      sendMessage({
        type: 'question.next.ready',
        requestId: nextRequestId(),
        payload: { gameId, questionId },
      })
    },
    returnToLobby(gameId) {
      emit({ type: 'local.answer.selected', answerId: null })
      emit({ type: 'session.sync', session: null })
      sendMessage({
        type: 'lobby.return',
        requestId: nextRequestId(),
        payload: { gameId },
      })
    },
  }
}
