export type AuthMode = 'guest' | 'oidc'

export type LobbyGame = {
  id: string
  hostName: string
  topic: string
  questionCount: number
  createdAt: string
}

export type Player = {
  id: string
  name: string
  score: number
  isReadyForNext: boolean
  didAnswerCorrectly?: boolean
}

export type QuestionOption = {
  id: string
  label: string
  text: string
}

export type Question = {
  id: string
  prompt: string
  topic: string
  options: QuestionOption[]
  correctOptionId: string
}

export type GamePhase =
  | 'waiting_for_player'
  | 'question_active'
  | 'answer_reveal'
  | 'waiting_for_next'
  | 'results'

export type GameSession = {
  id: string
  topic: string
  totalQuestions: number
  questionIndex: number
  phase: GamePhase
  players: [Player, Player]
  currentQuestion: Question | null
  selectedAnswerId: string | null
  questionEndsAt: string | null
  resultMessage: string | null
  winnerLabel: string | null
}

export type AppScreen = 'landing' | 'lobby' | 'game'
