import type { GameSession, LobbyGame, Player, Question } from './types'

const QUESTION_TIME_MS = 30_000

const QUESTIONS: Record<string, Question[]> = {
  science: [
    {
      id: 'science-1',
      topic: 'Science',
      prompt: 'Which planet has the most moons currently known?',
      correctOptionId: 'd',
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
      correctOptionId: 'b',
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
      correctOptionId: 'c',
      options: [
        { id: 'a', label: 'A', text: '186' },
        { id: 'b', label: 'B', text: '198' },
        { id: 'c', label: 'C', text: '206' },
        { id: 'd', label: 'D', text: '216' },
        { id: 'e', label: 'E', text: '226' },
      ],
    },
  ],
  cinema: [
    {
      id: 'cinema-1',
      topic: 'Cinema',
      prompt: 'Which film won the Academy Award for Best Picture for 2020?',
      correctOptionId: 'a',
      options: [
        { id: 'a', label: 'A', text: 'Parasite' },
        { id: 'b', label: 'B', text: '1917' },
        { id: 'c', label: 'C', text: 'Joker' },
        { id: 'd', label: 'D', text: 'Nomadland' },
        { id: 'e', label: 'E', text: 'Green Book' },
      ],
    },
    {
      id: 'cinema-2',
      topic: 'Cinema',
      prompt: 'Which director made "Spirited Away"?',
      correctOptionId: 'e',
      options: [
        { id: 'a', label: 'A', text: 'Makoto Shinkai' },
        { id: 'b', label: 'B', text: 'Satoshi Kon' },
        { id: 'c', label: 'C', text: 'Mamoru Hosoda' },
        { id: 'd', label: 'D', text: 'Isao Takahata' },
        { id: 'e', label: 'E', text: 'Hayao Miyazaki' },
      ],
    },
    {
      id: 'cinema-3',
      topic: 'Cinema',
      prompt: 'What color pill does Neo take in "The Matrix"?',
      correctOptionId: 'd',
      options: [
        { id: 'a', label: 'A', text: 'Green' },
        { id: 'b', label: 'B', text: 'Yellow' },
        { id: 'c', label: 'C', text: 'White' },
        { id: 'd', label: 'D', text: 'Red' },
        { id: 'e', label: 'E', text: 'Blue' },
      ],
    },
  ],
  world: [
    {
      id: 'world-1',
      topic: 'World',
      prompt: 'Which river runs through Budapest?',
      correctOptionId: 'b',
      options: [
        { id: 'a', label: 'A', text: 'Rhine' },
        { id: 'b', label: 'B', text: 'Danube' },
        { id: 'c', label: 'C', text: 'Seine' },
        { id: 'd', label: 'D', text: 'Po' },
        { id: 'e', label: 'E', text: 'Tagus' },
      ],
    },
    {
      id: 'world-2',
      topic: 'World',
      prompt: 'What is the capital city of New Zealand?',
      correctOptionId: 'c',
      options: [
        { id: 'a', label: 'A', text: 'Auckland' },
        { id: 'b', label: 'B', text: 'Christchurch' },
        { id: 'c', label: 'C', text: 'Wellington' },
        { id: 'd', label: 'D', text: 'Hamilton' },
        { id: 'e', label: 'E', text: 'Dunedin' },
      ],
    },
    {
      id: 'world-3',
      topic: 'World',
      prompt: 'Which country has the largest coastline in the world?',
      correctOptionId: 'a',
      options: [
        { id: 'a', label: 'A', text: 'Canada' },
        { id: 'b', label: 'B', text: 'Australia' },
        { id: 'c', label: 'C', text: 'Russia' },
        { id: 'd', label: 'D', text: 'Indonesia' },
        { id: 'e', label: 'E', text: 'United States' },
      ],
    },
  ],
}

const TOPIC_TO_KEY: Record<string, keyof typeof QUESTIONS> = {
  Science: 'science',
  Cinema: 'cinema',
  World: 'world',
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
    topic: 'Cinema',
    questionCount: 3,
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: 'game-103',
    hostName: 'Sana',
    topic: 'World',
    questionCount: 3,
    createdAt: new Date(Date.now() - 19 * 60_000).toISOString(),
  },
]

type PendingTimers = {
  secondPlayerJoin?: number
  opponentAnswer?: number
  reveal?: number
  opponentNext?: number
}

export function createMockSession(playerName: string) {
  let lobbyGames = [...OPEN_GAMES_SEED]
  let session: GameSession | null = null
  let pending: PendingTimers = {}

  const getLobbyGames = () => [...lobbyGames].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const resetPending = () => {
    for (const timer of Object.values(pending)) {
      if (timer) {
        window.clearTimeout(timer)
      }
    }
    pending = {}
  }

  const currentPlayers = (): [Player, Player] => {
    if (!session) {
      throw new Error('No active session')
    }
    return session.players
  }

  const buildSession = (game: LobbyGame, youAreHost: boolean): GameSession => {
    const localPlayer: Player = {
      id: 'you',
      name: playerName,
      score: 0,
      isReadyForNext: false,
    }
    const remotePlayer: Player = {
      id: 'opponent',
      name: youAreHost ? 'Waiting...' : game.hostName,
      score: 0,
      isReadyForNext: false,
    }

    return {
      id: game.id,
      topic: game.topic,
      totalQuestions: game.questionCount,
      questionIndex: 0,
      phase: youAreHost ? 'waiting_for_player' : 'question_active',
      players: youAreHost ? [localPlayer, remotePlayer] : [remotePlayer, localPlayer],
      currentQuestion: null,
      selectedAnswerId: null,
      questionEndsAt: null,
      resultMessage: null,
      winnerLabel: null,
    }
  }

  const getQuestionSet = (topic: string) => {
    const key = TOPIC_TO_KEY[topic]
    return QUESTIONS[key]
  }

  const startQuestion = () => {
    if (!session) {
      return
    }
    const question = getQuestionSet(session.topic)[session.questionIndex]
    const players = currentPlayers().map((player) => ({
      ...player,
      isReadyForNext: false,
      didAnswerCorrectly: undefined,
    })) as [Player, Player]

    session = {
      ...session,
      phase: 'question_active',
      currentQuestion: question,
      selectedAnswerId: null,
      questionEndsAt: new Date(Date.now() + QUESTION_TIME_MS).toISOString(),
      resultMessage: null,
      players,
    }

    scheduleOpponentAnswer()
    scheduleReveal()
  }

  const scheduleSecondPlayerJoin = () => {
    pending.secondPlayerJoin = window.setTimeout(() => {
      if (!session || session.phase !== 'waiting_for_player') {
        return
      }
      const [local, remote] = session.players
      session = {
        ...session,
        players: [local, { ...remote, name: 'Player Two' }],
      }
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
      const [p1] = currentPlayers()
      const opponentIndex = p1.id === 'you' ? 1 : 0
      const players = [...currentPlayers()] as [Player, Player]
      const correctId = currentQuestion.correctOptionId
      const optionIds = currentQuestion.options.map((option) => option.id)
      const answeredCorrectly = Math.random() > 0.5
      const chosen = answeredCorrectly
        ? correctId
        : optionIds.find((id) => id !== correctId) ?? correctId
      const opponent = players[opponentIndex]
      players[opponentIndex] = {
        ...opponent,
        didAnswerCorrectly: chosen === correctId,
      }
      session = {
        ...session,
        players,
      }
      maybeRevealEarly()
    }, delay)
  }

  const scheduleReveal = () => {
    pending.reveal = window.setTimeout(() => {
      revealQuestion()
    }, QUESTION_TIME_MS)
  }

  const maybeRevealEarly = () => {
    if (!session || session.phase !== 'question_active') {
      return
    }
    const [p1, p2] = currentPlayers()
    const localAnswered = session.selectedAnswerId !== null
    const remoteAnswered =
      (p1.id === 'opponent' ? p1.didAnswerCorrectly : p2.didAnswerCorrectly) !== undefined

    if (localAnswered && remoteAnswered) {
      if (pending.reveal) {
        window.clearTimeout(pending.reveal)
      }
      pending.reveal = window.setTimeout(() => {
        revealQuestion()
      }, 700)
    }
  }

  const revealQuestion = () => {
    if (!session || !session.currentQuestion) {
      return
    }
    const correctId = session.currentQuestion.correctOptionId
    const players = currentPlayers().map((player) => ({ ...player })) as [Player, Player]
    const localIndex = players[0].id === 'you' ? 0 : 1
    const localPlayer = players[localIndex]
    const localCorrect = session.selectedAnswerId === correctId
    players[localIndex] = {
      ...localPlayer,
      score: localPlayer.score + (localCorrect ? 1 : 0),
      didAnswerCorrectly: localCorrect,
    }

    const remoteIndex = localIndex === 0 ? 1 : 0
    const remotePlayer = players[remoteIndex]
    players[remoteIndex] = {
      ...remotePlayer,
      score:
        remotePlayer.score + (remotePlayer.didAnswerCorrectly ? 1 : 0),
    }

    session = {
      ...session,
      players,
      phase: 'answer_reveal',
      questionEndsAt: null,
      resultMessage:
        session.selectedAnswerId === null
          ? 'Time ran out. Your answer counted as no answer.'
          : localCorrect
            ? 'Locked in and correct.'
            : 'Locked in, but not correct this round.',
    }
  }

  const scheduleOpponentNext = () => {
    pending.opponentNext = window.setTimeout(() => {
      if (!session || session.phase !== 'waiting_for_next') {
        return
      }
      const players = currentPlayers().map((player) => ({ ...player })) as [Player, Player]
      const opponentIndex = players[0].id === 'opponent' ? 0 : 1
      players[opponentIndex].isReadyForNext = true
      session = { ...session, players }
      advanceIfReady()
    }, 1_500)
  }

  const advanceIfReady = () => {
    if (!session) {
      return
    }
    const ready = session.players.every((player) => player.isReadyForNext)
    if (!ready) {
      return
    }
    const nextIndex = session.questionIndex + 1
    if (nextIndex >= session.totalQuestions) {
      const [first, second] = session.players
      const winnerLabel =
        first.score === second.score
          ? 'Draw game'
          : first.score > second.score
            ? `${first.name} wins`
            : `${second.name} wins`
      session = {
        ...session,
        phase: 'results',
        questionIndex: nextIndex,
        winnerLabel,
      }
      return
    }
    session = {
      ...session,
      questionIndex: nextIndex,
    }
    startQuestion()
  }

  return {
    getLobbyGames,
    getSession: () => session,
    createGame(topic: string, questionCount: number) {
      resetPending()
      const lobbyGame: LobbyGame = {
        id: `game-${Math.round(Math.random() * 10_000)}`,
        hostName: playerName,
        topic,
        questionCount,
        createdAt: new Date().toISOString(),
      }
      session = buildSession(lobbyGame, true)
      scheduleSecondPlayerJoin()
      return session
    },
    joinGame(gameId: string) {
      resetPending()
      const game = lobbyGames.find((entry) => entry.id === gameId)
      if (!game) {
        throw new Error('That game is no longer available.')
      }
      lobbyGames = lobbyGames.filter((entry) => entry.id !== gameId)
      session = buildSession(game, false)
      startQuestion()
      return session
    },
    submitAnswer(answerId: string) {
      if (!session || session.phase !== 'question_active' || session.selectedAnswerId) {
        return session
      }
      session = {
        ...session,
        selectedAnswerId: answerId,
      }
      maybeRevealEarly()
      return session
    },
    readyForNext() {
      if (!session || session.phase !== 'answer_reveal') {
        return session
      }
      const players = currentPlayers().map((player) => ({ ...player })) as [Player, Player]
      const localIndex = players[0].id === 'you' ? 0 : 1
      players[localIndex].isReadyForNext = true
      session = {
        ...session,
        players,
        phase: 'waiting_for_next',
      }
      scheduleOpponentNext()
      advanceIfReady()
      return session
    },
    backToLobby() {
      resetPending()
      session = null
    },
  }
}
