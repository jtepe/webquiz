import type {
  ClientMessage,
  GameSnapshotPayload,
  ServerMessage,
} from '../src/backend/protocol.ts'

type RunnerOptions = {
  url: string
  hostName: string
  joinerName: string
  topic: string
  timeoutMs: number
  traceJson: boolean
  hostAnswerId: string | null
  joinerAnswerId: string | null
  clientVersion: string
}

type Waiter = {
  description: string
  matches: (message: ServerMessage) => boolean
  resolve: (message: ServerMessage) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

type SocketLike = {
  addEventListener: (type: string, listener: (event?: { data?: unknown }) => void) => void
  close: () => void
  send: (data: string) => void
}

type SessionReadyMessage = Extract<ServerMessage, { type: 'session.ready' }>
type LobbySnapshotMessage = Extract<ServerMessage, { type: 'lobby.snapshot' }>
type GameCreatedMessage = {
  type: 'game.created'
  requestId?: string
  payload: GameSnapshotPayload
}
type GameJoinedMessage = {
  type: 'game.joined'
  requestId?: string
  payload: GameSnapshotPayload
}
type GamePlayerJoinedMessage = Extract<ServerMessage, { type: 'game.player_joined' }>
type QuestionStartedMessage = Extract<ServerMessage, { type: 'question.started' }>
type AnswerAcceptedMessage = Extract<ServerMessage, { type: 'answer.accepted' }>
type AnswerLockedMessage = Extract<ServerMessage, { type: 'answer.locked' }>
type QuestionRevealedMessage = Extract<ServerMessage, { type: 'question.revealed' }>
type QuestionNextWaitingMessage = Extract<ServerMessage, { type: 'question.next.waiting' }>
type GameResultsMessage = Extract<ServerMessage, { type: 'game.results' }>
type ErrorMessage = Extract<ServerMessage, { type: 'error' }>

const expectedClientMessageTypes = [
  'session.hello',
  'player.identify',
  'lobby.subscribe',
  'game.create',
  'game.join',
  'answer.submit',
  'question.next.ready',
  'lobby.return',
] satisfies ClientMessage['type'][]

const expectedServerMessageTypes = [
  'session.ready',
  'lobby.snapshot',
  'game.created',
  'game.joined',
  'game.player_joined',
  'question.started',
  'answer.accepted',
  'answer.locked',
  'question.revealed',
  'question.next.waiting',
  'game.results',
  'error',
] satisfies ServerMessage['type'][]

class Reporter {
  private readonly traceJson: boolean

  constructor(traceJson: boolean) {
    this.traceJson = traceJson
  }

  step(message: string) {
    console.log(message)
  }

  outbound(clientLabel: string, message: ClientMessage) {
    console.log(`${clientLabel} -> ${describeClientMessage(message)}`)
    this.printJson(message)
  }

  inbound(clientLabel: string, message: ServerMessage) {
    console.log(`${clientLabel} <- ${describeServerMessage(message)}`)
    this.printJson(message)
  }

  printSummary(
    gameId: string,
    questionId: string,
    winnerLabel: string,
    duplicateAnswerErrorCode: string,
  ) {
    console.log('')
    console.log('Run completed.')
    console.log(`game=${gameId} question=${questionId} winner="${winnerLabel}" duplicateAnswerError=${duplicateAnswerErrorCode}`)
  }

  private printJson(message: ClientMessage | ServerMessage) {
    if (!this.traceJson) {
      return
    }

    console.log(JSON.stringify(message, null, 2))
  }
}

class ProtocolClient {
  readonly sentMessages: ClientMessage[] = []
  readonly receivedMessages: ServerMessage[] = []

  private readonly clientLabel: string
  private readonly reporter: Reporter
  private readonly timeoutMs: number
  private readonly clientVersion: string
  private readonly url: string
  private socket: SocketLike | null = null
  private requestCounter = 0
  private waiters = new Set<Waiter>()
  private terminalError: Error | null = null

  constructor(
    clientLabel: string,
    options: Pick<RunnerOptions, 'clientVersion' | 'timeoutMs' | 'url'>,
    reporter: Reporter,
  ) {
    this.clientLabel = clientLabel
    this.clientVersion = options.clientVersion
    this.timeoutMs = options.timeoutMs
    this.url = options.url
    this.reporter = reporter
  }

  async connect(): Promise<SessionReadyMessage> {
    const WebSocketConstructor = getWebSocketConstructor()
    const socket = new WebSocketConstructor(this.url)
    this.socket = socket

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[${this.clientLabel}] Timed out opening ${this.url}.`))
      }, this.timeoutMs)

      socket.addEventListener('open', () => {
        clearTimeout(timer)
        resolve()
      })

      socket.addEventListener('error', () => {
        const error = new Error(`[${this.clientLabel}] WebSocket connection error.`)
        clearTimeout(timer)
        this.fail(error)
        reject(error)
      })

      socket.addEventListener('close', () => {
        const error = new Error(`[${this.clientLabel}] WebSocket closed unexpectedly.`)
        clearTimeout(timer)
        this.fail(error)
        reject(error)
      })

      socket.addEventListener('message', (event) => {
        this.handleIncomingMessage(event?.data)
      })
    })

    const requestId = this.send({
      type: 'session.hello',
      requestId: this.nextRequestId(),
      payload: {
        protocolVersion: 1,
        clientVersion: this.clientVersion,
        resumeToken: null,
      },
    })

    const ready = await this.waitForMessage(
      'session.ready',
      (message): message is SessionReadyMessage => message.type === 'session.ready',
    )
    validateRequestId(ready, requestId, `${this.clientLabel} session.ready`)
    return ready
  }

  identifyPlayer(displayName: string) {
    this.send({
      type: 'player.identify',
      requestId: this.nextRequestId(),
      payload: { displayName },
    })
  }

  subscribeLobby() {
    this.send({
      type: 'lobby.subscribe',
      requestId: this.nextRequestId(),
      payload: {},
    })
  }

  createGame(topic: string, questionCount: number) {
    return this.send({
      type: 'game.create',
      requestId: this.nextRequestId(),
      payload: { topic, questionCount },
    })
  }

  joinGame(gameId: string) {
    return this.send({
      type: 'game.join',
      requestId: this.nextRequestId(),
      payload: { gameId },
    })
  }

  submitAnswer(gameId: string, questionId: string, answerId: string) {
    return this.send({
      type: 'answer.submit',
      requestId: this.nextRequestId(),
      payload: { gameId, questionId, answerId },
    })
  }

  readyForNext(gameId: string, questionId: string) {
    return this.send({
      type: 'question.next.ready',
      requestId: this.nextRequestId(),
      payload: { gameId, questionId },
    })
  }

  returnToLobby(gameId: string) {
    return this.send({
      type: 'lobby.return',
      requestId: this.nextRequestId(),
      payload: { gameId },
    })
  }

  waitForMessage<T extends ServerMessage>(
    description: string,
    matches: (message: ServerMessage) => message is T,
    timeoutMs = this.timeoutMs,
  ): Promise<T> {
    if (this.terminalError) {
      return Promise.reject(this.terminalError)
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(waiter)
        reject(new Error(`[${this.clientLabel}] Timed out waiting for ${description}.`))
      }, timeoutMs)

      const waiter: Waiter = {
        description,
        matches,
        resolve: (message) => {
          clearTimeout(timer)
          this.waiters.delete(waiter)
          resolve(message as T)
        },
        reject: (error) => {
          clearTimeout(timer)
          this.waiters.delete(waiter)
          reject(error)
        },
        timer,
      }

      this.waiters.add(waiter)
    })
  }

  async waitForOptionalMessage<T extends ServerMessage>(
    description: string,
    matches: (message: ServerMessage) => message is T,
    timeoutMs = this.timeoutMs,
  ): Promise<T | null> {
    try {
      return await this.waitForMessage(description, matches, timeoutMs)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Timed out waiting for')) {
        return null
      }

      throw error
    }
  }

  close() {
    this.socket?.close()
    this.socket = null
  }

  private fail(error: Error) {
    if (this.terminalError) {
      return
    }

    this.terminalError = error
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer)
      waiter.reject(error)
    }
    this.waiters.clear()
  }

  private handleIncomingMessage(rawData: unknown) {
    try {
      const text = normalizeIncomingData(rawData)
      const message = JSON.parse(text) as ServerMessage
      this.receivedMessages.push(message)
      this.reporter.inbound(this.clientLabel, message)

      let matchedWaiter = false
      for (const waiter of [...this.waiters]) {
        if (!waiter.matches(message)) {
          continue
        }

        matchedWaiter = true
        waiter.resolve(message)
      }

      if (message.type === 'error' && !matchedWaiter) {
        this.fail(
          new Error(`[${this.clientLabel}] Unexpected error ${message.payload.code}: ${message.payload.message}`),
        )
      }
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(`[${this.clientLabel}] Failed to process inbound message.`)
      this.fail(normalizedError)
    }
  }

  private nextRequestId() {
    this.requestCounter += 1
    return `${this.clientLabel}_${this.requestCounter}`
  }

  private send<T extends ClientMessage>(message: T) {
    assert(this.socket, `[${this.clientLabel}] Socket is not connected.`)
    this.sentMessages.push(message)
    this.reporter.outbound(this.clientLabel, message)
    this.socket.send(JSON.stringify(message))
    return message.requestId
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!options) {
    return
  }

  const reporter = new Reporter(options.traceJson)
  const host = new ProtocolClient('host', options, reporter)
  const joiner = new ProtocolClient('joiner', options, reporter)

  try {
    reporter.step(`Connecting to ${options.url}`)
    const [hostReady, joinerReady] = await Promise.all([host.connect(), joiner.connect()])
    reporter.step(`Connected host=${hostReady.payload.playerId} joiner=${joinerReady.payload.playerId}`)

    reporter.step('Identifying players')
    host.identifyPlayer(options.hostName)
    joiner.identifyPlayer(options.joinerName)

    reporter.step('Subscribing both clients to the lobby')
    const hostLobbySnapshotPromise = host.waitForMessage(
      'initial lobby snapshot',
      (message): message is LobbySnapshotMessage => message.type === 'lobby.snapshot',
    )
    const joinerLobbySnapshotPromise = joiner.waitForMessage(
      'initial lobby snapshot',
      (message): message is LobbySnapshotMessage => message.type === 'lobby.snapshot',
    )
    host.subscribeLobby()
    joiner.subscribeLobby()
    await Promise.all([hostLobbySnapshotPromise, joinerLobbySnapshotPromise])

    reporter.step('Creating a one-question game from the host client')
    const joinerLobbyUpdatePromise = joiner.waitForMessage(
      'lobby update with the created game',
      (message): message is LobbySnapshotMessage =>
        message.type === 'lobby.snapshot' &&
        message.payload.games.some((game) => game.hostName === options.hostName && game.topic === options.topic),
    )
    const hostCreatedPromise = host.waitForMessage(
      'game.created',
      (message): message is GameCreatedMessage => message.type === 'game.created',
    )
    const createRequestId = host.createGame(options.topic, 1)
    const created = await hostCreatedPromise
    validateRequestId(created, createRequestId, 'game.created')
    await joinerLobbyUpdatePromise

    const gameId = created.payload.game.id
    const hostPlayerId = created.payload.game.players[0]?.id
    assert(hostPlayerId, 'Host player id was not present in game.created.')
    assert(created.payload.game.players[0]?.name === options.hostName, 'Host name did not round-trip through game.created.')

    reporter.step(`Joining game ${gameId} from the second client`)
    const hostPlayerJoinedPromise = host.waitForMessage(
      'game.player_joined on host',
      (message): message is GamePlayerJoinedMessage =>
        message.type === 'game.player_joined' && message.payload.gameId === gameId,
    )
    const joinerPlayerJoinedPromise = joiner.waitForMessage(
      'game.player_joined on joiner',
      (message): message is GamePlayerJoinedMessage =>
        message.type === 'game.player_joined' && message.payload.gameId === gameId,
    )
    const hostQuestionStartedPromise = host.waitForMessage(
      'question.started on host',
      (message): message is QuestionStartedMessage =>
        message.type === 'question.started' && message.payload.gameId === gameId,
    )
    const joinerQuestionStartedPromise = joiner.waitForMessage(
      'question.started on joiner',
      (message): message is QuestionStartedMessage =>
        message.type === 'question.started' && message.payload.gameId === gameId,
    )
    const joinerJoinedPromise = joiner.waitForMessage(
      'game.joined',
      (message): message is GameJoinedMessage =>
        message.type === 'game.joined' && message.payload.game.id === gameId,
    )
    const joinRequestId = joiner.joinGame(gameId)
    const joined = await joinerJoinedPromise
    validateRequestId(joined, joinRequestId, 'game.joined')

    const [hostPlayerJoined, joinerPlayerJoined, hostQuestionStarted, joinerQuestionStarted] = await Promise.all([
      hostPlayerJoinedPromise,
      joinerPlayerJoinedPromise,
      hostQuestionStartedPromise,
      joinerQuestionStartedPromise,
    ])

    assert(
      hostPlayerJoined.payload.player.name === options.joinerName,
      'Host did not observe the expected joiner name in game.player_joined.',
    )
    assert(
      joinerPlayerJoined.payload.player.name === options.joinerName,
      'Joiner did not observe the expected joiner name in game.player_joined.',
    )

    const joinerPlayerId = joined.payload.game.players.at(-1)?.id
    assert(joinerPlayerId, 'Joiner player id was not present in game.joined.')
    assert(
      joined.payload.game.players.at(-1)?.name === options.joinerName,
      'Joiner name did not round-trip through game.joined.',
    )
    assert(
      hostQuestionStarted.payload.question.id === joinerQuestionStarted.payload.question.id,
      'Clients received different question ids.',
    )
    assert(hostQuestionStarted.payload.questionCount === 1, 'The runner expects a one-question game.')

    const questionId = hostQuestionStarted.payload.question.id
    const hostAnswerId = resolveAnswerId(hostQuestionStarted, options.hostAnswerId, 0, 'host')
    const joinerAnswerId = resolveAnswerId(joinerQuestionStarted, options.joinerAnswerId, 1, 'joiner')

    reporter.step(`Submitting host answer ${hostAnswerId}`)
    const hostAcceptedPromise = host.waitForMessage(
      'host answer.accepted',
      (message): message is AnswerAcceptedMessage =>
        message.type === 'answer.accepted' &&
        message.payload.gameId === gameId &&
        message.payload.questionId === questionId &&
        message.payload.playerId === hostPlayerId,
    )
    const joinerObservedHostLockPromise = joiner.waitForMessage(
      'answer.locked for host on joiner',
      (message): message is AnswerLockedMessage =>
        message.type === 'answer.locked' &&
        message.payload.gameId === gameId &&
        message.payload.questionId === questionId &&
        message.payload.playerId === hostPlayerId,
    )
    const hostAnswerRequestId = host.submitAnswer(gameId, questionId, hostAnswerId)
    const hostAccepted = await hostAcceptedPromise
    validateRequestId(hostAccepted, hostAnswerRequestId, 'host answer.accepted')
    await joinerObservedHostLockPromise

    reporter.step('Submitting a duplicate host answer to exercise the error path')
    const duplicateAnswerErrorPromise = host.waitForMessage(
      'duplicate answer error',
      (message): message is ErrorMessage => message.type === 'error',
    )
    const duplicateAnswerRequestId = host.submitAnswer(gameId, questionId, hostAnswerId)
    const duplicateAnswerError = await duplicateAnswerErrorPromise
    validateRequestId(duplicateAnswerError, duplicateAnswerRequestId, 'duplicate answer error')

    reporter.step(`Submitting joiner answer ${joinerAnswerId}`)
    const joinerAcceptedPromise = joiner.waitForMessage(
      'joiner answer.accepted',
      (message): message is AnswerAcceptedMessage =>
        message.type === 'answer.accepted' &&
        message.payload.gameId === gameId &&
        message.payload.questionId === questionId &&
        message.payload.playerId === joinerPlayerId,
    )
    const hostObservedJoinerLockPromise = host.waitForMessage(
      'answer.locked for joiner on host',
      (message): message is AnswerLockedMessage =>
        message.type === 'answer.locked' &&
        message.payload.gameId === gameId &&
        message.payload.questionId === questionId &&
        message.payload.playerId === joinerPlayerId,
    )
    const hostRevealPromise = host.waitForMessage(
      'question.revealed on host',
      (message): message is QuestionRevealedMessage =>
        message.type === 'question.revealed' &&
        message.payload.gameId === gameId &&
        message.payload.questionId === questionId,
    )
    const joinerRevealPromise = joiner.waitForMessage(
      'question.revealed on joiner',
      (message): message is QuestionRevealedMessage =>
        message.type === 'question.revealed' &&
        message.payload.gameId === gameId &&
        message.payload.questionId === questionId,
    )
    const joinerAnswerRequestId = joiner.submitAnswer(gameId, questionId, joinerAnswerId)
    const joinerAccepted = await joinerAcceptedPromise
    validateRequestId(joinerAccepted, joinerAnswerRequestId, 'joiner answer.accepted')
    await hostObservedJoinerLockPromise
    const [hostReveal, joinerReveal] = await Promise.all([hostRevealPromise, joinerRevealPromise])
    assert(hostReveal.payload.reason === 'both_answered', 'Expected question.revealed reason to be both_answered.')
    assert(
      hostReveal.payload.correctAnswerId === joinerReveal.payload.correctAnswerId,
      'Clients received different correctAnswerId values.',
    )

    reporter.step('Advancing to the end-of-game results screen')
    const hostWaitingPromise = host.waitForMessage(
      'question.next.waiting on host',
      (message): message is QuestionNextWaitingMessage =>
        message.type === 'question.next.waiting' &&
        message.payload.gameId === gameId &&
        message.payload.questionId === questionId,
    )
    const joinerWaitingPromise = joiner.waitForMessage(
      'question.next.waiting on joiner',
      (message): message is QuestionNextWaitingMessage =>
        message.type === 'question.next.waiting' &&
        message.payload.gameId === gameId &&
        message.payload.questionId === questionId,
    )
    host.readyForNext(gameId, questionId)
    await Promise.all([hostWaitingPromise, joinerWaitingPromise])

    const hostResultsPromise = host.waitForMessage(
      'game.results on host',
      (message): message is GameResultsMessage =>
        message.type === 'game.results' && message.payload.gameId === gameId,
    )
    const joinerResultsPromise = joiner.waitForMessage(
      'game.results on joiner',
      (message): message is GameResultsMessage =>
        message.type === 'game.results' && message.payload.gameId === gameId,
    )
    joiner.readyForNext(gameId, questionId)
    const [hostResults, joinerResults] = await Promise.all([hostResultsPromise, joinerResultsPromise])
    assert(
      hostResults.payload.winnerLabel === joinerResults.payload.winnerLabel,
      'Clients received different winner labels.',
    )

    reporter.step('Returning both clients to the lobby')
    const hostPostReturnSnapshotPromise = host.waitForOptionalMessage(
      'post-return lobby.snapshot on host',
      (message): message is LobbySnapshotMessage => message.type === 'lobby.snapshot',
      Math.floor(options.timeoutMs / 2),
    )
    const joinerPostReturnSnapshotPromise = joiner.waitForOptionalMessage(
      'post-return lobby.snapshot on joiner',
      (message): message is LobbySnapshotMessage => message.type === 'lobby.snapshot',
      Math.floor(options.timeoutMs / 2),
    )
    host.returnToLobby(gameId)
    joiner.returnToLobby(gameId)

    const hostPostReturnSnapshot = await hostPostReturnSnapshotPromise
    if (!hostPostReturnSnapshot) {
      reporter.step('host <- no lobby snapshot after lobby.return; re-subscribing to confirm lobby access')
      const hostResubscribePromise = host.waitForMessage(
        'lobby snapshot after host re-subscribe',
        (message): message is LobbySnapshotMessage => message.type === 'lobby.snapshot',
      )
      host.subscribeLobby()
      await hostResubscribePromise
    }

    const joinerPostReturnSnapshot = await joinerPostReturnSnapshotPromise
    if (!joinerPostReturnSnapshot) {
      reporter.step('joiner <- no lobby snapshot after lobby.return; re-subscribing to confirm lobby access')
      const joinerResubscribePromise = joiner.waitForMessage(
        'lobby snapshot after joiner re-subscribe',
        (message): message is LobbySnapshotMessage => message.type === 'lobby.snapshot',
      )
      joiner.subscribeLobby()
      await joinerResubscribePromise
    }

    assertCoverage(host, joiner)
    reporter.printSummary(
      gameId,
      questionId,
      hostResults.payload.winnerLabel,
      duplicateAnswerError.payload.code,
    )
  } finally {
    host.close()
    joiner.close()
  }
}

function getWebSocketConstructor() {
  const WebSocketConstructor = (globalThis as { WebSocket?: new (url: string) => SocketLike }).WebSocket
  assert(WebSocketConstructor, 'This runner needs a Bun/WebSocket runtime.')
  return WebSocketConstructor
}

function normalizeIncomingData(rawData: unknown) {
  if (typeof rawData === 'string') {
    return rawData
  }

  if (rawData instanceof ArrayBuffer) {
    return new TextDecoder().decode(rawData)
  }

  if (ArrayBuffer.isView(rawData)) {
    return new TextDecoder().decode(
      new Uint8Array(rawData.buffer, rawData.byteOffset, rawData.byteLength),
    )
  }

  throw new Error('Inbound WebSocket message was not a supported text payload.')
}

function validateRequestId(
  message: Pick<ServerMessage, 'requestId'>,
  expectedRequestId: string,
  description: string,
) {
  if (message.requestId && message.requestId !== expectedRequestId) {
    throw new Error(`${description} had requestId=${message.requestId}, expected ${expectedRequestId}.`)
  }
}

function resolveAnswerId(
  questionStarted: QuestionStartedMessage,
  preferredAnswerId: string | null,
  fallbackIndex: number,
  clientLabel: string,
) {
  const options = questionStarted.payload.question.options
  if (preferredAnswerId) {
    const preferred = options.find((option) => option.id === preferredAnswerId)
    assert(preferred, `${clientLabel} preferred answer id ${preferredAnswerId} was not present in the question.`)
    return preferred.id
  }

  const fallback = options[fallbackIndex] ?? options[0]
  assert(fallback, `${clientLabel} question did not include any answer options.`)
  return fallback.id
}

function describeClientMessage(message: ClientMessage) {
  switch (message.type) {
    case 'session.hello':
      return `${message.type} requestId=${message.requestId} protocolVersion=${message.payload.protocolVersion}`
    case 'player.identify':
      return `${message.type} requestId=${message.requestId} displayName="${message.payload.displayName}"`
    case 'lobby.subscribe':
      return `${message.type} requestId=${message.requestId}`
    case 'game.create':
      return `${message.type} requestId=${message.requestId} topic="${message.payload.topic}" questionCount=${message.payload.questionCount}`
    case 'game.join':
      return `${message.type} requestId=${message.requestId} gameId=${message.payload.gameId}`
    case 'answer.submit':
      return `${message.type} requestId=${message.requestId} gameId=${message.payload.gameId} questionId=${message.payload.questionId} answerId=${message.payload.answerId}`
    case 'question.next.ready':
      return `${message.type} requestId=${message.requestId} gameId=${message.payload.gameId} questionId=${message.payload.questionId}`
    case 'lobby.return':
      return `${message.type} requestId=${message.requestId} gameId=${message.payload.gameId}`
  }
}

function describeServerMessage(message: ServerMessage) {
  switch (message.type) {
    case 'session.ready':
      return `${message.type}${formatOptionalRequestId(message)} playerId=${message.payload.playerId}`
    case 'lobby.snapshot':
      return `${message.type}${formatOptionalRequestId(message)} games=${message.payload.games.length}`
    case 'game.created':
    case 'game.joined':
      return `${message.type}${formatOptionalRequestId(message)} gameId=${message.payload.game.id} phase=${message.payload.game.phase}`
    case 'game.player_joined':
      return `${message.type}${formatOptionalRequestId(message)} gameId=${message.payload.gameId} player=${message.payload.player.name}`
    case 'question.started':
      return `${message.type}${formatOptionalRequestId(message)} gameId=${message.payload.gameId} questionId=${message.payload.question.id}`
    case 'answer.accepted':
      return `${message.type}${formatOptionalRequestId(message)} gameId=${message.payload.gameId} questionId=${message.payload.questionId} playerId=${message.payload.playerId}`
    case 'answer.locked':
      return `${message.type}${formatOptionalRequestId(message)} gameId=${message.payload.gameId} questionId=${message.payload.questionId} playerId=${message.payload.playerId}`
    case 'question.revealed':
      return `${message.type}${formatOptionalRequestId(message)} gameId=${message.payload.gameId} questionId=${message.payload.questionId} reason=${message.payload.reason}`
    case 'question.next.waiting':
      return `${message.type}${formatOptionalRequestId(message)} gameId=${message.payload.gameId} questionId=${message.payload.questionId}`
    case 'game.results':
      return `${message.type}${formatOptionalRequestId(message)} gameId=${message.payload.gameId} winner="${message.payload.winnerLabel}"`
    case 'error':
      return `${message.type}${formatOptionalRequestId(message)} code=${message.payload.code} message="${message.payload.message}"`
  }
}

function formatOptionalRequestId(message: Pick<ServerMessage, 'requestId'>) {
  return message.requestId ? ` requestId=${message.requestId}` : ''
}

function assertCoverage(host: ProtocolClient, joiner: ProtocolClient) {
  const sentTypes = new Set([...host.sentMessages, ...joiner.sentMessages].map((message) => message.type))
  const receivedTypes = new Set([...host.receivedMessages, ...joiner.receivedMessages].map((message) => message.type))

  for (const type of expectedClientMessageTypes) {
    assert(sentTypes.has(type), `The run did not send client message type ${type}.`)
  }

  for (const type of expectedServerMessageTypes) {
    assert(receivedTypes.has(type), `The run did not observe server message type ${type}.`)
  }
}

function parseArgs(argv: string[]): RunnerOptions | null {
  const defaults: RunnerOptions = {
    url: process.env.VITE_WS_URL ?? 'ws://localhost:8080',
    hostName: 'Host',
    joinerName: 'Joiner',
    topic: 'Science',
    timeoutMs: 10_000,
    traceJson: false,
    hostAnswerId: null,
    joinerAnswerId: null,
    clientVersion: 'webquiz-protocol-runner',
  }

  const options = { ...defaults }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case '--help':
      case '-h':
        printHelp(defaults)
        return null
      case '--trace-json':
        options.traceJson = true
        break
      case '--url':
        options.url = readRequiredValue(argv, ++index, '--url')
        break
      case '--host-name':
        options.hostName = readRequiredValue(argv, ++index, '--host-name')
        break
      case '--joiner-name':
        options.joinerName = readRequiredValue(argv, ++index, '--joiner-name')
        break
      case '--topic':
        options.topic = readRequiredValue(argv, ++index, '--topic')
        break
      case '--timeout-ms':
        options.timeoutMs = parsePositiveInteger(readRequiredValue(argv, ++index, '--timeout-ms'), '--timeout-ms')
        break
      case '--host-answer-id':
        options.hostAnswerId = readRequiredValue(argv, ++index, '--host-answer-id')
        break
      case '--joiner-answer-id':
        options.joinerAnswerId = readRequiredValue(argv, ++index, '--joiner-answer-id')
        break
      case '--client-version':
        options.clientVersion = readRequiredValue(argv, ++index, '--client-version')
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function readRequiredValue(argv: string[], index: number, flagName: string) {
  const value = argv[index]
  if (!value) {
    throw new Error(`Missing value for ${flagName}.`)
  }

  return value
}

function parsePositiveInteger(value: string, flagName: string) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`)
  }

  return parsed
}

function printHelp(defaults: RunnerOptions) {
  console.log(`Usage: bun run ws:protocol -- [options]

Runs a two-client WebSocket protocol exercise for a one-question game.

Options:
  --url <ws-url>               WebSocket URL. Default: ${defaults.url}
  --host-name <name>           Host display name. Default: ${defaults.hostName}
  --joiner-name <name>         Joiner display name. Default: ${defaults.joinerName}
  --topic <topic>              Quiz topic for game.create. Default: ${defaults.topic}
  --timeout-ms <ms>            Per-step timeout. Default: ${defaults.timeoutMs}
  --host-answer-id <id>        Force the host answer option id.
  --joiner-answer-id <id>      Force the joiner answer option id.
  --client-version <value>     session.hello clientVersion. Default: ${defaults.clientVersion}
  --trace-json                 Print raw inbound and outbound JSON.
  --help, -h                   Show this help.
`)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
