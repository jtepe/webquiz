# WebQuiz Frontend

Browser frontend for a two-player quiz game.

This repository contains the client application, a mock transport for local development, a WebSocket transport for a real backend, and the protocol document plus a runner script used to exercise that backend contract.

## Current Scope

- Landing page with guest entry and OIDC login initiation
- Lobby showing open games with host name, created time, topic, question count, and game id
- Create-game flow with topic selection and variable question counts
- Join-game flow from the lobby
- Waiting room for hosted games before player two joins
- Question screen with five answer options, server-driven countdown, and locked answers
- Reveal screen with the correct answer, per-player correctness, and updated scores
- Waiting-for-next state until both players continue
- Final results screen with return to lobby
- Connection status banner for connecting, connected, and disconnected states

## Backend Modes

- Mock backend is used by default when `VITE_WS_URL` is not set.
- Real backend is used when `VITE_WS_URL` is set and `VITE_USE_MOCK_BACKEND` is not `true`.
- The expected WebSocket contract is documented in [protocol.md](./protocol.md).
- A Bun-based protocol runner is included for exercising that contract against a backend implementation.

## Tech Stack

- `bun` for package management and scripts
- `React`
- `TypeScript`
- `Vite`
- `React Router`
- `XState`
- `Vitest`
- `Testing Library`

## Architecture

- React single-page app with routed landing, lobby, and game screens
- State-machine-driven client flow for lobby and match state
- Backend transport abstraction with mock and WebSocket implementations
- Shared frontend types for lobby, session, player, and question data
- Protocol documentation in [protocol.md](./protocol.md)

## Development

Install dependencies:

```bash
bun install
```

Start the app with the default mock backend:

```bash
bun run dev
```

Connect to a real backend over WebSocket:

```bash
VITE_WS_URL=ws://localhost:8080 bun run dev
```

Use OIDC as well:

```bash
VITE_IDP_URL=https://idp.example.com VITE_WS_URL=ws://localhost:8080 bun run dev
```

Force the mock backend even when `VITE_WS_URL` is present:

```bash
VITE_USE_MOCK_BACKEND=true bun run dev
```

Build:

```bash
bun run build
```

Preview the production build:

```bash
bun run preview
```

Lint:

```bash
bun run lint
```

Run tests:

```bash
bun run test
```

Use `bun run test`, not `bun test`. The suite is configured for Vitest with `jsdom`, and running it through Bun's built-in test runner will fail on browser globals and Vitest-specific helpers.

Run tests in watch mode:

```bash
bun run test:watch
```

Exercise a WebSocket backend against the documented protocol:

```bash
bun run ws:protocol -- --url ws://localhost:8080
```

Example with extra tracing and custom players:

```bash
bun run ws:protocol -- --trace-json --host-name Mira --joiner-name Jonah --topic Science
```

## Mock Backend Behavior

The mock transport is intended for local UI development and tests. It currently provides:

- a seeded lobby with open games
- creation and joining flows
- automatic second-player join for hosted games
- topic-based question decks with five options per question
- 30-second timed rounds
- answer locking and reveal transitions
- simulated opponent readiness for the next round

## Notes

- OIDC is handled over HTTP by the frontend. It calls `${VITE_IDP_URL}/me`, redirects to `${VITE_IDP_URL}/login?redirect={currentAppUrl}` on `401`, and resumes on return.
- Reconnect and session resume are not implemented yet.
- Duplicate guest names are currently allowed.
