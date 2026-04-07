# WebQuiz Frontend

Browser frontend for a two-player quiz game that is intended to run against a WebSocket backend.

This repository currently focuses on the client only. Server-side room management, question delivery, scores, and authoritative game state are assumed to exist behind a backend contract and are mocked locally for now.

## Current Scope

- Mobile-first browser UI
- Landing page with:
  - `Login with OIDC` placeholder
  - guest name entry
- Lobby showing open games with:
  - host name
  - created time
  - topic
  - question count
- Create new game flow
- Join existing game flow
- Waiting room for player two
- Question screen with:
  - 5 answer options
  - 30-second countdown
  - locked-in answers
- Reveal screen showing:
  - correct answer
  - whether each player was correct
  - updated scores
- Waiting-for-next synchronization state
- Final results screen with `Back to lobby`

## Tech Stack

- `bun` for package management and scripts
- `React`
- `TypeScript`
- `Vite`
- `React Router`
- `XState`
- `Vitest`
- `Testing Library`

## Project Structure

- `src/App.tsx`
  Main UI flow and route rendering.
- `src/backend/`
  Backend transport layer, including the real WebSocket client, protocol types, and mock fallback transport.
- `src/types.ts`
  Shared quiz, lobby, player, and session types.
- `src/App.css`
  Screen-level styling.
- `src/index.css`
  Global visual system and base styles.

## Development

Install dependencies:

```bash
bun install
```

Start the dev server:

```bash
bun run dev
```

Environment switches:

```bash
VITE_WS_URL=ws://localhost:8080 bun run dev
```

OIDC configuration:

```bash
VITE_IDP_URL=https://idp.example.com VITE_WS_URL=ws://localhost:8080 bun run dev
```

Use the mock backend explicitly:

```bash
VITE_USE_MOCK_BACKEND=true bun run dev
```

Run the production build:

```bash
bun run build
```

Run linting:

```bash
bun run lint
```

Run tests:

```bash
bun run test
```

Run the scripted WebSocket protocol exercise:

```bash
bun run ws:protocol -- --url ws://localhost:8080
```

Useful flags:

```bash
bun run ws:protocol -- --trace-json --host-name Mira --joiner-name Jonah --topic Science
```

## Mocked Backend Behavior

Until the real backend exists, the frontend uses a mocked session layer that simulates:

- open games in the lobby
- creating and joining games
- a second player joining after a short delay
- timed questions
- answer locking
- reveal timing
- opponent readiness for the next round

This lets the browser flow be designed and tested without committing to a backend implementation too early.

## Backend Contract Assumptions

The future backend should be authoritative for:

- available lobby games
- player roster
- question payloads
- `questionEndsAt`
- answer reveal timing
- scores
- next-round readiness
- final results

The frontend should only send player intents such as:

- create game
- join game
- submit answer
- ready for next question
- return to lobby

The expected WebSocket message contract and game/lobby state machine are documented in [protocol.md](./protocol.md).

## Notes

- OIDC is handled by the frontend over HTTP, not by the WebSocket backend. The frontend calls `${IDP_URL}/me`, redirects to `${IDP_URL}/login?redirect={MY_HOST}` on `401`, and retries `/me` after returning.
- Reconnect handling is out of scope for the current version.
- Duplicate guest names are currently allowed.
