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
- `src/mockServer.ts`
  Mocked backend/session transport used during frontend development.
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

## Notes

- OIDC is intentionally not implemented yet. The entry point exists so it can be added later without redesigning the landing flow.
- Reconnect handling is out of scope for the current version.
- Duplicate guest names are currently allowed.
