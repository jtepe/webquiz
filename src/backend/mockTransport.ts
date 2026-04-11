import type { BackendEvent, BackendTransport } from './transport'
import type { GameSession, LobbyGame, Player, Question } from '../types'

const QUESTION_TIME_MS = 30_000

const QUESTIONS: Record<string, Question[]> = {
  science: [
    {
      id: 'science-1',
      topic: 'Science',
      prompt: 'Which planet has the most moons currently known?',
      options: [
        { id: 'a', label: 'A', text: 'Earth' },
        { id: 'b', label: 'B', text: 'Mars' },
        { id: 'c', label: 'C', text: 'Jupiter' },
        { id: 'd', label: 'D', text: 'Saturn' },
        { id: 'e', label: 'E', text: 'Neptune' },
      ],
    },
    {
      id: 'science-2',
      topic: 'Science',
      prompt: 'What gas do plants absorb from the atmosphere?',
      options: [
        { id: 'a', label: 'A', text: 'Oxygen' },
        { id: 'b', label: 'B', text: 'Carbon dioxide' },
        { id: 'c', label: 'C', text: 'Nitrogen' },
        { id: 'd', label: 'D', text: 'Hydrogen' },
        { id: 'e', label: 'E', text: 'Helium' },
      ],
    },
    {
      id: 'science-3',
      topic: 'Science',
      prompt: 'How many bones are in an adult human body?',
      options: [
        { id: 'a', label: 'A', text: '186' },
        { id: 'b', label: 'B', text: '198' },
        { id: 'c', label: 'C', text: '206' },
        { id: 'd', label: 'D', text: '216' },
        { id: 'e', label: 'E', text: '226' },
      ],
    },
  ],
  nerd: [
    {
      id: 'nerd-1',
      topic: 'Nerd',
      prompt: 'In "The Lord of the Rings", what is the Elvish word for "friend" used to open the Doors of Durin?',
      options: [
        { id: 'a', label: 'A', text: 'Mellon' },
        { id: 'b', label: 'B', text: 'Mithrandir' },
        { id: 'c', label: 'C', text: 'A Elbereth' },
        { id: 'd', label: 'D', text: 'Namarie' },
        { id: 'e', label: 'E', text: 'Elen sila lumenn omentielvo' },
      ],
    },
    {
      id: 'nerd-2',
      topic: 'Nerd',
      prompt: 'What is the name of Han Solo\'s ship?',
      options: [
        { id: 'a', label: 'A', text: 'Razor Crest' },
        { id: 'b', label: 'B', text: 'Millennium Falcon' },
        { id: 'c', label: 'C', text: 'Ghost' },
        { id: 'd', label: 'D', text: 'Ebon Hawk' },
        { id: 'e', label: 'E', text: 'Slave I' },
      ],
    },
    {
      id: 'nerd-3',
      topic: 'Nerd',
      prompt: 'Which company developed the original Game Boy?',
      options: [
        { id: 'a', label: 'A', text: 'Sega' },
        { id: 'b', label: 'B', text: 'Atari' },
        { id: 'c', label: 'C', text: 'Nintendo' },
        { id: 'd', label: 'D', text: 'Sony' },
        { id: 'e', label: 'E', text: 'Bandai' },
      ],
    },
  ],
  sherlock: [
    {
      id: 'sherlock-1',
      topic: 'Sherlock Holmes',
      prompt: 'Who created Sherlock Holmes?',
      options: [
        { id: 'a', label: 'A', text: 'Arthur Conan Doyle' },
        { id: 'b', label: 'B', text: 'Agatha Christie' },
        { id: 'c', label: 'C', text: 'G. K. Chesterton' },
        { id: 'd', label: 'D', text: 'Wilkie Collins' },
        { id: 'e', label: 'E', text: 'Edgar Allan Poe' },
      ],
    },
    {
      id: 'sherlock-2',
      topic: 'Sherlock Holmes',
      prompt: 'What is Dr. Watson\'s first name?',
      options: [
        { id: 'a', label: 'A', text: 'James' },
        { id: 'b', label: 'B', text: 'John' },
        { id: 'c', label: 'C', text: 'Joseph' },
        { id: 'd', label: 'D', text: 'Jonathan' },
        { id: 'e', label: 'E', text: 'Jeremy' },
      ],
    },
    {
      id: 'sherlock-3',
      topic: 'Sherlock Holmes',
      prompt: 'What is the address of Sherlock Holmes\' London flat?',
      options: [
        { id: 'a', label: 'A', text: '12 Fleet Street' },
        { id: 'b', label: 'B', text: '10 Downing Street' },
        { id: 'c', label: 'C', text: '221B Baker Street' },
        { id: 'd', label: 'D', text: '7 Savile Row' },
        { id: 'e', label: 'E', text: '14 Henrietta Street' },
      ],
    },
  ],
}

const ANSWER_KEY: Record<string, string> = {
  'science-1': 'd',
  'science-2': 'b',
  'science-3': 'c',
  'nerd-1': 'a',
  'nerd-2': 'b',
  'nerd-3': 'c',
  'sherlock-1': 'a',
  'sherlock-2': 'b',
  'sherlock-3': 'c',
}

const TOPIC_TO_KEY: Record<string, keyof typeof QUESTIONS> = {
  Science: 'science',
  Nerd: 'nerd',
  'Sherlock Holmes': 'sherlock',
}

const OPEN_GAMES_SEED: LobbyGame[] = [
  {
    id: 'game-101',
    hostName: 'Mira',
    topic: 'Science',
    questionCount: 3,
    createdAt: new Date(Date.now() - 7 * 60_000).toISOString(),
  },
  {
    id: 'game-102',
    hostName: 'Jonah',
    topic: 'Nerd',
    questionCount: 5,
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: 'game-103',
    hostName: 'Sana',
    topic: 'Sherlock Holmes',
    questionCount: 7,
    createdAt: new Date(Date.now() - 19 * 60_000).toISOString(),
  },
]

type PendingTimers = {
  secondPlayerJoin?: number
  opponentAnswer?: number
  reveal?: number
  opponentNext?: number
}

export function createMockTransport(): BackendTransport {
  const listeners = new Set<(event: BackendEvent) => void>()
  let playerName = ''
  let selfPlayerId = 'player_1'
  let lobbyGames = [...OPEN_GAMES_SEED]
  let session: GameSession | null = null
  let questionDeck: Question[] = []
  let localSelectedAnswerId: string | null = null
  let pending: PendingTimers = {}

  const emit = (event: BackendEvent) => {
    for (const listener of listeners) {
      listener(event)
    }
  }

  const emitAuthReady = () => {
    emit({
      type: 'auth.ready',
      playerId: selfPlayerId,
    })
  }

  const emitSession = () => {
    emit({ type: 'session.sync', session })
  }

  const emitLobby = () => {
    emit({
      type: 'lobby.snapshot',
      games: [...lobbyGames].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    })
  }

  const resetPending = () => {
    for (const timer of Object.values(pending)) {
      if (timer) {
        window.clearTimeout(timer)
      }
    }
    pending = {}
  }

  const normalizePlayers = (players: Player[]): [Player, Player] => {
    if (players.length >= 2) {
      return [players[0], players[1]]
    }
    return [
      players[0],
      {
        id: 'player_2',
        name: 'Waiting for player two',
        score: 0,
        isReadyForNext: false,
        hasLockedAnswer: false,
      },
    ]
  }

  const getCurrentQuestion = () => questionDeck[session?.questionIndex ?? 0] ?? null

  const buildQuestionDeck = (topic: string, questionCount: number) => {
    const source = QUESTIONS[TOPIC_TO_KEY[topic]]
    return Array.from({ length: questionCount }, (_, index) => {
      const template = source[index % source.length]
      return {
        ...template,
        id: `${template.id}-${index + 1}`,
      }
    })
  }

  const buildSession = (game: LobbyGame, youAreHost: boolean): GameSession => {
    const host: Player = {
      id: 'player_1',
      name: youAreHost ? playerName : game.hostName,
      score: 0,
      isReadyForNext: false,
      hasLockedAnswer: false,
    }
    const guest: Player = {
      id: 'player_2',
      name: youAreHost ? 'Waiting for player two' : playerName,
      score: 0,
      isReadyForNext: false,
      hasLockedAnswer: false,
    }
    selfPlayerId = youAreHost ? 'player_1' : 'player_2'

    return {
      id: game.id,
      topic: game.topic,
      totalQuestions: game.questionCount,
      questionIndex: 0,
      phase: youAreHost ? 'waiting_for_player' : 'question_active',
      players: [host, guest],
      currentQuestion: null,
      correctAnswerId: null,
      questionEndsAt: null,
      resultMessage: null,
      winnerLabel: null,
    }
  }

  const startQuestion = () => {
    if (!session) {
      return
    }
    localSelectedAnswerId = null
    emit({ type: 'local.answer.selected', answerId: null })

    session = {
      ...session,
      phase: 'question_active',
      currentQuestion: getCurrentQuestion(),
      correctAnswerId: null,
      questionEndsAt: new Date(Date.now() + QUESTION_TIME_MS).toISOString(),
      resultMessage: null,
      players: normalizePlayers(
        session.players.map((player) => ({
          ...player,
          isReadyForNext: false,
          hasLockedAnswer: false,
          didAnswerCorrectly: undefined,
        })),
      ),
    }

    emitSession()
    scheduleOpponentAnswer()
    scheduleReveal()
  }

  const localPlayerIndex = () => (session?.players[0].id === selfPlayerId ? 0 : 1)
  const opponentPlayerIndex = () => (localPlayerIndex() === 0 ? 1 : 0)

  const scheduleSecondPlayerJoin = () => {
    pending.secondPlayerJoin = window.setTimeout(() => {
      if (!session || session.phase !== 'waiting_for_player') {
        return
      }
      const players = [...session.players] as [Player, Player]
      players[1] = {
        ...players[1],
        name: 'Player Two',
      }
      session = {
        ...session,
        players,
      }
      emitSession()
      startQuestion()
    }, 2_200)
  }

  const scheduleOpponentAnswer = () => {
    if (!session || !session.currentQuestion) {
      return
    }
    const currentQuestion = session.currentQuestion
    const delay = 4_000 + Math.floor(Math.random() * 8_000)
    pending.opponentAnswer = window.setTimeout(() => {
      if (!session || session.phase !== 'question_active') {
        return
      }
      const players = [...session.players] as [Player, Player]
      const opponentIndex = opponentPlayerIndex()
      const correctId = ANSWER_KEY[currentQuestion.id.split('-').slice(0, 2).join('-')]
      const optionIds = currentQuestion.options.map((option) => option.id)
      const answeredCorrectly = Math.random() > 0.5
      const chosen = answeredCorrectly
        ? correctId
        : optionIds.find((id) => id !== correctId) ?? correctId
      players[opponentIndex] = {
        ...players[opponentIndex],
        hasLockedAnswer: true,
        didAnswerCorrectly: chosen === correctId,
      }
      session = {
        ...session,
        players,
      }
      emitSession()
      maybeRevealEarly()
    }, delay)
  }

  const scheduleReveal = () => {
    pending.reveal = window.setTimeout(() => {
      revealQuestion('time_expired')
    }, QUESTION_TIME_MS)
  }

  const maybeRevealEarly = () => {
    if (!session || session.phase !== 'question_active') {
      return
    }
    const everyoneLocked = session.players.every((player) => player.hasLockedAnswer)
    if (!everyoneLocked) {
      return
    }
    if (pending.reveal) {
      window.clearTimeout(pending.reveal)
    }
    pending.reveal = window.setTimeout(() => {
      revealQuestion('both_answered')
    }, 700)
  }

  const revealQuestion = (reason: 'both_answered' | 'time_expired') => {
    if (!session || !session.currentQuestion) {
      return
    }
    const correctAnswerId = ANSWER_KEY[session.currentQuestion.id.split('-').slice(0, 2).join('-')]
    const players = session.players.map((player) => ({ ...player })) as [Player, Player]
    const localIndex = localPlayerIndex()
    const localCorrect = localSelectedAnswerId === correctAnswerId

    players[localIndex] = {
      ...players[localIndex],
      score: players[localIndex].score + (localCorrect ? 1 : 0),
      hasLockedAnswer: true,
      didAnswerCorrectly: localCorrect,
    }

    const remoteIndex = opponentPlayerIndex()
    players[remoteIndex] = {
      ...players[remoteIndex],
      score: players[remoteIndex].score + (players[remoteIndex].didAnswerCorrectly ? 1 : 0),
      hasLockedAnswer: true,
    }

    const resultMessage =
      reason === 'time_expired' && localSelectedAnswerId === null
        ? 'Time ran out. Your answer counted as no answer.'
        : localCorrect
          ? 'Locked in and correct.'
          : 'Locked in, but not correct this round.'

    session = {
      ...session,
      players,
      phase: 'answer_reveal',
      correctAnswerId,
      questionEndsAt: null,
      resultMessage,
    }
    emitSession()
  }

  const scheduleOpponentNext = () => {
    pending.opponentNext = window.setTimeout(() => {
      if (!session || session.phase !== 'waiting_for_next') {
        return
      }
      const players = [...session.players] as [Player, Player]
      players[opponentPlayerIndex()] = {
        ...players[opponentPlayerIndex()],
        isReadyForNext: true,
      }
      session = { ...session, players }
      emitSession()
      advanceIfReady()
    }, 1_500)
  }

  const advanceIfReady = () => {
    if (!session || !session.players.every((player) => player.isReadyForNext)) {
      return
    }
    const nextIndex = session.questionIndex + 1
    if (nextIndex >= session.totalQuestions) {
      const [first, second] = session.players
      session = {
        ...session,
        phase: 'results',
        questionIndex: nextIndex,
        winnerLabel:
          first.score === second.score
            ? 'Draw game'
            : first.score > second.score
              ? `${first.name} wins`
              : `${second.name} wins`,
      }
      emitSession()
      return
    }
    session = {
      ...session,
      questionIndex: nextIndex,
    }
    startQuestion()
  }

  return {
    connect() {
      emit({ type: 'connection.status', status: 'connecting' })
      window.setTimeout(() => {
        emit({ type: 'connection.status', status: 'connected' })
      }, 150)
    },
    disconnect() {
      resetPending()
      emit({ type: 'connection.status', status: 'disconnected' })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    identifyPlayer(displayName) {
      playerName = displayName
      emitAuthReady()
    },
    subscribeLobby() {
      emitLobby()
    },
    createGame(topic, questionCount) {
      resetPending()
      const game: LobbyGame = {
        id: `game-${Math.round(Math.random() * 10_000)}`,
        hostName: playerName,
        topic,
        questionCount,
        createdAt: new Date().toISOString(),
      }
      questionDeck = buildQuestionDeck(topic, questionCount)
      session = buildSession(game, true)
      emitAuthReady()
      emitSession()
      scheduleSecondPlayerJoin()
    },
    joinGame(gameId) {
      resetPending()
      const game = lobbyGames.find((entry) => entry.id === gameId)
      if (!game) {
        emit({
          type: 'error',
          message: 'That game is no longer available.',
        })
        emitLobby()
        return
      }
      lobbyGames = lobbyGames.filter((entry) => entry.id !== gameId)
      questionDeck = buildQuestionDeck(game.topic, game.questionCount)
      session = buildSession(game, false)
      emitAuthReady()
      startQuestion()
    },
    submitAnswer(_gameId, _questionId, answerId) {
      if (!session || session.phase !== 'question_active' || localSelectedAnswerId !== null) {
        return
      }
      localSelectedAnswerId = answerId
      emit({ type: 'local.answer.selected', answerId })
      const players = [...session.players] as [Player, Player]
      players[localPlayerIndex()] = {
        ...players[localPlayerIndex()],
        hasLockedAnswer: true,
      }
      session = { ...session, players }
      emitSession()
      maybeRevealEarly()
    },
    readyForNext() {
      if (!session || session.phase !== 'answer_reveal') {
        return
      }
      const players = [...session.players] as [Player, Player]
      players[localPlayerIndex()] = {
        ...players[localPlayerIndex()],
        isReadyForNext: true,
      }
      session = {
        ...session,
        players,
        phase: 'waiting_for_next',
      }
      emitSession()
      scheduleOpponentNext()
      advanceIfReady()
    },
    returnToLobby() {
      resetPending()
      session = null
      localSelectedAnswerId = null
      emit({ type: 'local.answer.selected', answerId: null })
      emitSession()
      emitLobby()
    },
  }
}
