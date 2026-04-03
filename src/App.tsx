import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useMachine } from '@xstate/react'
import { assign, setup } from 'xstate'
import './App.css'
import { createMockSession } from './mockServer'
import type { AppScreen, AuthMode, GameSession, LobbyGame } from './types'

type AppContext = {
  authMode: AuthMode | null
  playerName: string
  screen: AppScreen
  lobbyGames: LobbyGame[]
  session: GameSession | null
  error: string | null
}

type AppEvent =
  | { type: 'ENTER_GUEST'; playerName: string }
  | { type: 'CHOOSE_OIDC' }
  | { type: 'LOAD_LOBBY'; lobbyGames: LobbyGame[] }
  | { type: 'CREATE_GAME'; session: GameSession }
  | { type: 'JOIN_GAME'; session: GameSession }
  | { type: 'SYNC_SESSION'; session: GameSession | null }
  | { type: 'RETURN_TO_LOBBY'; lobbyGames: LobbyGame[] }
  | { type: 'SET_ERROR'; message: string | null }

const appMachine = setup({
  types: {
    context: {} as AppContext,
    events: {} as AppEvent,
  },
}).createMachine({
  id: 'webquiz-app',
  initial: 'landing',
  context: {
    authMode: null,
    playerName: '',
    screen: 'landing',
    lobbyGames: [],
    session: null,
    error: null,
  },
  states: {
    landing: {
      on: {
        ENTER_GUEST: {
          target: 'lobby',
          actions: assign(({ event }) => ({
            authMode: 'guest',
            playerName: event.playerName,
            screen: 'lobby',
            error: null,
          })),
        },
        CHOOSE_OIDC: {
          actions: assign({
            authMode: 'oidc',
            error: 'OIDC will be added later. Guest mode stays available in v1.',
          }),
        },
      },
    },
    lobby: {
      on: {
        LOAD_LOBBY: {
          actions: assign(({ event }) => ({
            lobbyGames: event.lobbyGames,
            screen: 'lobby',
          })),
        },
        CREATE_GAME: {
          target: 'game',
          actions: assign(({ event }) => ({
            session: event.session,
            screen: 'game',
            error: null,
          })),
        },
        JOIN_GAME: {
          target: 'game',
          actions: assign(({ event }) => ({
            session: event.session,
            screen: 'game',
            error: null,
          })),
        },
        SET_ERROR: {
          actions: assign(({ event }) => ({ error: event.message })),
        },
      },
    },
    game: {
      on: {
        SYNC_SESSION: {
          actions: assign(({ event }) => ({
            session: event.session,
          })),
        },
        RETURN_TO_LOBBY: {
          target: 'lobby',
          actions: assign(({ event }) => ({
            session: null,
            lobbyGames: event.lobbyGames,
            screen: 'lobby',
            error: null,
          })),
        },
        SET_ERROR: {
          actions: assign(({ event }) => ({ error: event.message })),
        },
      },
    },
  },
})

const TOPIC_OPTIONS = ['Science', 'Cinema', 'World'] as const
const QUESTION_COUNT_OPTIONS = [10, 12, 15]

function App() {
  const navigate = useNavigate()
  const [state, send] = useMachine(appMachine)
  const [guestName, setGuestName] = useState('')
  const [newGameTopic, setNewGameTopic] = useState<(typeof TOPIC_OPTIONS)[number]>('Science')
  const [newGameQuestionCount, setNewGameQuestionCount] = useState(10)
  const [now, setNow] = useState(() => Date.now())

  const transport = useMemo(() => {
    if (!state.context.playerName) {
      return null
    }
    return createMockSession(state.context.playerName)
  }, [state.context.playerName])

  useEffect(() => {
    const nextPath = state.context.screen === 'game' ? `/game/${state.context.session?.id ?? ''}` : state.context.screen === 'lobby' ? '/lobby' : '/'
    navigate(nextPath, { replace: true })
  }, [navigate, state.context.screen, state.context.session?.id])

  useEffect(() => {
    if (!transport) {
      return
    }
    send({ type: 'LOAD_LOBBY', lobbyGames: transport.getLobbyGames() })
  }, [send, transport])

  useEffect(() => {
    if (!state.context.session || state.context.session.phase === 'results') {
      return
    }
    const timer = window.setInterval(() => {
      const session = transport?.getSession()
      if (session) {
        send({ type: 'SYNC_SESSION', session })
      }
      setNow(Date.now())
    }, 250)
    return () => window.clearInterval(timer)
  }, [send, state.context.session, transport])

  const countdown = useMemo(() => {
    const endsAt = state.context.session?.questionEndsAt
    if (!endsAt) {
      return 0
    }
    return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000))
  }, [now, state.context.session?.questionEndsAt])

  const createGame = () => {
    if (!transport) {
      return
    }
    const session = transport.createGame(newGameTopic, newGameQuestionCount)
    send({ type: 'CREATE_GAME', session })
  }

  const joinGame = (gameId: string) => {
    if (!transport) {
      return
    }
    try {
      const session = transport.joinGame(gameId)
      send({ type: 'JOIN_GAME', session })
    } catch (error) {
      send({
        type: 'SET_ERROR',
        message: error instanceof Error ? error.message : 'Unable to join game.',
      })
      send({ type: 'LOAD_LOBBY', lobbyGames: transport.getLobbyGames() })
    }
  }

  const submitAnswer = (answerId: string) => {
    const session = transport?.submitAnswer(answerId)
    if (session) {
      send({ type: 'SYNC_SESSION', session })
    }
  }

  const readyForNext = () => {
    const session = transport?.readyForNext()
    if (session) {
      send({ type: 'SYNC_SESSION', session })
    }
  }

  const backToLobby = () => {
    transport?.backToLobby()
    if (transport) {
      send({ type: 'RETURN_TO_LOBBY', lobbyGames: transport.getLobbyGames() })
    }
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route
          path="/"
          element={
            <LandingScreen
              guestName={guestName}
              error={state.context.error}
              onGuestNameChange={setGuestName}
              onContinueAsGuest={() => {
                const trimmed = guestName.trim()
                if (!trimmed) {
                  send({ type: 'SET_ERROR', message: 'Enter a name to continue as guest.' })
                  return
                }
                send({ type: 'ENTER_GUEST', playerName: trimmed })
              }}
              onOidcClick={() => send({ type: 'CHOOSE_OIDC' })}
            />
          }
        />
        <Route
          path="/lobby"
          element={
            state.context.playerName ? (
              <LobbyScreen
                error={state.context.error}
                games={state.context.lobbyGames}
                playerName={state.context.playerName}
                newGameTopic={newGameTopic}
                newGameQuestionCount={newGameQuestionCount}
                onTopicChange={setNewGameTopic}
                onQuestionCountChange={setNewGameQuestionCount}
                onCreateGame={createGame}
                onJoinGame={joinGame}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/game/:gameId"
          element={
            state.context.session ? (
              <GameScreen
                countdown={countdown}
                session={state.context.session}
                onAnswerSelect={submitAnswer}
                onBackToLobby={backToLobby}
                onReadyForNext={readyForNext}
              />
            ) : (
              <Navigate to="/lobby" replace />
            )
          }
        />
      </Routes>
    </div>
  )
}

type LandingScreenProps = {
  guestName: string
  error: string | null
  onGuestNameChange: (name: string) => void
  onContinueAsGuest: () => void
  onOidcClick: () => void
}

function LandingScreen(props: LandingScreenProps) {
  return (
    <main className="screen landing-screen">
      <section className="hero-panel">
        <p className="eyebrow">Two-player browser quiz</p>
        <h1>Fast rounds, locked answers, clean scorekeeping.</h1>
        <p className="hero-copy">
          Start a new game, join an open room, and play a server-driven quiz that
          stays in sync over WebSockets.
        </p>
        <div className="hero-grid">
          <article className="hero-card">
            <span>2 players</span>
            <strong>Realtime head-to-head</strong>
          </article>
          <article className="hero-card">
            <span>30 seconds</span>
            <strong>One locked answer each round</strong>
          </article>
          <article className="hero-card">
            <span>Variable length</span>
            <strong>Server controls the question set</strong>
          </article>
        </div>
      </section>

      <section className="entry-panel">
        <div className="entry-card">
          <p className="eyebrow">Sign in later</p>
          <h2>Choose how to enter</h2>
          <button className="secondary-button" onClick={props.onOidcClick} type="button">
            Login with OIDC
          </button>
          <div className="divider">
            <span>or continue as guest</span>
          </div>
          <label className="field">
            <span>Display name</span>
            <input
              autoComplete="nickname"
              maxLength={20}
              placeholder="Type your name"
              value={props.guestName}
              onChange={(event) => props.onGuestNameChange(event.target.value)}
            />
          </label>
          <button className="primary-button" onClick={props.onContinueAsGuest} type="button">
            Enter lobby
          </button>
          {props.error ? <p className="inline-error">{props.error}</p> : null}
        </div>
      </section>
    </main>
  )
}

type LobbyScreenProps = {
  error: string | null
  games: LobbyGame[]
  playerName: string
  newGameTopic: string
  newGameQuestionCount: number
  onTopicChange: (topic: (typeof TOPIC_OPTIONS)[number]) => void
  onQuestionCountChange: (count: number) => void
  onCreateGame: () => void
  onJoinGame: (gameId: string) => void
}

function LobbyScreen(props: LobbyScreenProps) {
  return (
    <main className="screen lobby-screen">
      <section className="section-card intro-card">
        <div>
          <p className="eyebrow">Lobby</p>
          <h1>{props.playerName}, pick your next match.</h1>
        </div>
        <p className="support-copy">
          Open games are waiting for a second player. Creating a new game adds your room
          to the server queue until another player joins.
        </p>
      </section>

      <section className="section-grid">
        <article className="section-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Create</p>
              <h2>Start a new game</h2>
            </div>
          </div>
          <label className="field">
            <span>Topic</span>
            <select
              value={props.newGameTopic}
              onChange={(event) =>
                props.onTopicChange(event.target.value as (typeof TOPIC_OPTIONS)[number])
              }
            >
              {TOPIC_OPTIONS.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Questions</span>
            <select
              value={props.newGameQuestionCount}
              onChange={(event) => props.onQuestionCountChange(Number(event.target.value))}
            >
              {QUESTION_COUNT_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" onClick={props.onCreateGame} type="button">
            Create game
          </button>
        </article>

        <article className="section-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Join</p>
              <h2>Open games</h2>
            </div>
            <span className="pill">{props.games.length} available</span>
          </div>
          {props.games.length === 0 ? (
            <div className="empty-state">
              <p>No open games right now.</p>
              <p>Create one to become the host.</p>
            </div>
          ) : (
            <div className="game-list">
              {props.games.map((game) => (
                <button
                  key={game.id}
                  className="game-row"
                  onClick={() => props.onJoinGame(game.id)}
                  type="button"
                >
                  <div className="game-row-top">
                    <strong>{game.hostName}</strong>
                    <span>{formatRelativeTime(game.createdAt)}</span>
                  </div>
                  <div className="game-row-meta">
                    <span>{game.topic}</span>
                    <span>{game.questionCount} questions</span>
                    <span>{game.id}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {props.error ? <p className="inline-error">{props.error}</p> : null}
        </article>
      </section>
    </main>
  )
}

type GameScreenProps = {
  countdown: number
  session: GameSession
  onAnswerSelect: (answerId: string) => void
  onReadyForNext: () => void
  onBackToLobby: () => void
}

function GameScreen(props: GameScreenProps) {
  const localPlayer = props.session.players.find((player) => player.id === 'you')!
  const opponent = props.session.players.find((player) => player.id === 'opponent')!
  const questionNumber = Math.min(props.session.questionIndex + 1, props.session.totalQuestions)

  return (
    <main className="screen game-screen">
      <header className="scoreboard">
        {props.session.players.map((player) => (
          <article key={player.id} className={`score-card ${player.id === 'you' ? 'is-local' : ''}`}>
            <span>{player.id === 'you' ? 'You' : 'Opponent'}</span>
            <strong>{player.name}</strong>
            <em>{player.score} pts</em>
          </article>
        ))}
      </header>

      {props.session.phase === 'waiting_for_player' ? (
        <section className="section-card waiting-card">
          <p className="eyebrow">Waiting room</p>
          <h1>Your game is live on the lobby list.</h1>
          <p className="support-copy">
            The backend will keep this game open until a second player joins. In the mock
            flow, another player joins automatically after a short delay.
          </p>
          <div className="waiting-grid">
            <div>
              <span>Topic</span>
              <strong>{props.session.topic}</strong>
            </div>
            <div>
              <span>Questions</span>
              <strong>{props.session.totalQuestions}</strong>
            </div>
            <div>
              <span>Opponent</span>
              <strong>{opponent.name}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {props.session.phase === 'question_active' && props.session.currentQuestion ? (
        <section className="section-card question-card">
          <div className="question-topline">
            <div>
              <p className="eyebrow">
                Question {questionNumber} of {props.session.totalQuestions}
              </p>
              <h1>{props.session.currentQuestion.prompt}</h1>
            </div>
            <div className="timer">
              <span>Time left</span>
              <strong>{props.countdown}s</strong>
            </div>
          </div>
          <div className="status-strip">
            <span>{props.session.currentQuestion.topic}</span>
            <span>{localPlayer.name}: {props.session.selectedAnswerId ? 'answer locked' : 'choosing'}</span>
            <span>{opponent.name}: {opponent.didAnswerCorrectly === undefined ? 'choosing' : 'answer locked'}</span>
          </div>
          <div className="answers-grid">
            {props.session.currentQuestion.options.map((option) => {
              const isSelected = props.session.selectedAnswerId === option.id
              const isDisabled = props.session.selectedAnswerId !== null
              return (
                <button
                  key={option.id}
                  className={`answer-card ${isSelected ? 'is-selected' : ''}`}
                  disabled={isDisabled}
                  onClick={() => props.onAnswerSelect(option.id)}
                  type="button"
                >
                  <span>{option.label}</span>
                  <strong>{option.text}</strong>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {props.session.phase === 'answer_reveal' && props.session.currentQuestion ? (
        <section className="section-card reveal-card">
          <p className="eyebrow">Answer reveal</p>
          <h1>{props.session.currentQuestion.prompt}</h1>
          <div className="reveal-banner">
            <span>Correct answer</span>
            <strong>
              {
                props.session.currentQuestion.options.find(
                  (option) => option.id === props.session.currentQuestion?.correctOptionId,
                )?.text
              }
            </strong>
          </div>
          <div className="result-grid">
            <article className={localPlayer.didAnswerCorrectly ? 'result-card success' : 'result-card miss'}>
              <span>You</span>
              <strong>{localPlayer.didAnswerCorrectly ? 'Correct' : 'Not correct'}</strong>
            </article>
            <article className={opponent.didAnswerCorrectly ? 'result-card success' : 'result-card miss'}>
              <span>{opponent.name}</span>
              <strong>{opponent.didAnswerCorrectly ? 'Correct' : 'Not correct'}</strong>
            </article>
          </div>
          <p className="support-copy">{props.session.resultMessage}</p>
          <button className="primary-button" onClick={props.onReadyForNext} type="button">
            Next question
          </button>
        </section>
      ) : null}

      {props.session.phase === 'waiting_for_next' ? (
        <section className="section-card waiting-card">
          <p className="eyebrow">Waiting</p>
          <h1>Round locked. Waiting for both players to continue.</h1>
          <div className="waiting-grid">
            {props.session.players.map((player) => (
              <div key={player.id}>
                <span>{player.name}</span>
                <strong>{player.isReadyForNext ? 'Ready' : 'Waiting'}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {props.session.phase === 'results' ? (
        <section className="section-card results-card">
          <p className="eyebrow">Final score</p>
          <h1>{props.session.winnerLabel}</h1>
          <div className="result-grid">
            {props.session.players.map((player) => (
              <article key={player.id} className="result-card neutral">
                <span>{player.id === 'you' ? 'You' : player.name}</span>
                <strong>{player.score} points</strong>
              </article>
            ))}
          </div>
          <button className="primary-button" onClick={props.onBackToLobby} type="button">
            Back to lobby
          </button>
        </section>
      ) : null}
    </main>
  )
}

function formatRelativeTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const diffMinutes = Math.max(1, Math.round(diffMs / 60_000))
  return `${diffMinutes} min ago`
}

export default App
