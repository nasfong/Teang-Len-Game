# BACKEND_PLAN.md — Teang Len API, mapped to *our* frontend

> **What this is.** [BACKEND_SPEC.md](BACKEND_SPEC.md) is the authoritative, implementation-independent server contract (REST routes, socket events, lifecycle rules). **This document does not restate it** — it plans how *our* frontend (the `Login → Home → Room → Table` flow in this repo) consumes that contract: which page calls what, how the server's shapes map onto our component props, what has to change in `GameTable`/`engine.js` for real multiplayer, and the build order.
>
> **No code is changed by this document.** It is the blueprint we implement against in Q3.

---

## 0. Ground rules for our build

| Decision | Choice | Why |
|---|---|---|
| Backend language | **TypeScript** | Per spec §0; type-safe contract at the boundary. |
| Frontend language | **Stays JSX/JS** for now | Migrate to TS later; integration layer is plain JS + hooks. |
| Backend location | New **`backend/`** folder in this repo (monorepo-style) | Keeps the shared `events` contract next to the frontend mirror. |
| Storage | **In-memory `Map`** only | Per spec §1 — no DB. |
| Game authority | **`src/components/GameTable/engine.js`** (frontend) | Spec §1 hard boundary: backend never reads `gameState`. Our `engine.js` (`deal`, `classify`, `canBeat`, `validatePlay`, `label`, `sortCards`) is *the* engine the spec refers to. |
| Envelope | `{ ok: true, data } \| { ok: false, error }` everywhere | Spec §11. |

**The one-line boundary:** our `engine.js` computes a move → we emit the resulting `gameState` → backend stores it opaquely → backend rebroadcasts. The backend never interprets a card.

---

## 1. Our flow ↔ which backend layer

```
┌─────────┐  REST          ┌────────┐  REST           ┌────────┐  REST + SOCKET   ┌────────┐
│ Login   │ ──register/──▶ │ Home   │ ──list rooms──▶ │ Room   │ ──join+connect─▶ │ Table  │
│ Page    │    login       │ Page   │    (browse)     │ Page   │                  │ Page   │
└─────────┘                └────────┘                 └────────┘                  └────────┘
   POST /auth/*              GET /users/me             GET  /rooms                 POST /rooms/:id/join
   → {token,user,wallet}     GET /wallet               POST /rooms  (create)       socket room:join
                             (PLAY → navigate)         POST /rooms/:id/join        socket game:* (play/skip/start)
                                                                                   socket game:update / turn:timeout / game:end
```

- **Login / Home / Room = REST only.** Simple request/response; no live connection needed.
- **Table = REST (join) + a live Socket.IO connection** for the whole match. The socket opens when we enter `TablePage` and closes on leave.

---

## 2. Page-by-page API mapping (the core of this plan)

For each page: what it renders today, what it needs from the server, the exact call(s), and how the response fills our existing component props.

### 2.1 LoginPage → Auth

- **Component:** [`LoginPage`](src/components/LoginPage/LoginPage.jsx) wraps `AuthForm`; reports `onSubmit({ mode, username, password })`, has a `busy` flag, `onModeChange`.
- **`mode` maps to the endpoint:** `'signup' → POST /api/auth/register`, `'login' → POST /api/auth/login`.
- Our form has no `displayName` field → send `displayName = username` (spec defaults it anyway).

| Our form value | Request | Response `data` | Where it goes |
|---|---|---|---|
| `{ mode:'signup', username, password }` | `POST /api/auth/register` `{ username, password }` | `{ token, user, wallet }` | store `token`; `user`→session; `wallet.coin`→Header coin |
| `{ mode:'login', username, password }` | `POST /api/auth/login` `{ username, password }` | `{ token, user, wallet }` | same |

- `busy` = request in flight (locks the submit — `AuthForm` already supports it).
- On success → persist token (memory + `localStorage` for refresh recovery) → navigate to Home.
- **402/401/409** → surface as an `AuthForm` error (bad creds → generic "Invalid username or password").

### 2.2 HomePage → Identity + Wallet

- **Component:** [`HomePage`](src/components/HomePage/HomePage.jsx) shows `username`, `coin`, `avatarSrc`; `onPlay` → Room; hosts `SelectMode` (game mode) + `DailyBonus`.
- On mount (or from the login response) populate the Header:

| Need | Call | Fills |
|---|---|---|
| Who am I | `GET /api/users/me` → `PublicUser` | `HomePage.username`, `avatarSrc` |
| Balance | `GET /api/wallet` → `{ coin, gem }` | `HomePage.coin` |

- **`SelectMode` (solo / with-friends / online):** the spec has **no solo/bot mode** (§13: no AI). So:
  - `online` / `with_friends` → go to RoomPage (real rooms).
  - `solo` → **stays fully client-side** using today's `GameTable` bot demo; it never touches the backend. (Document this: solo is an offline mode.)
- **`PLAY` (`onPlay`)** → navigate to RoomPage.

### 2.3 RoomPage → Lobby (list / create / join)

- **Component:** [`RoomPage`](src/components/RoomPage/RoomPage.jsx) renders a grid of `RoomCard`s; `onJoin(room)`, `onCreate`, `onBack`, `joiningId`. `CreateRoomForm` collects `name` + `betCoin` (Slider) + `maxPlayers` (SquareToggle).

| Action | Call | Response | Notes |
|---|---|---|---|
| List | `GET /api/rooms` | `RoomSnapshot[]` (waiting only) | map → our RoomCard shape (see §3) |
| Create | `POST /api/rooms` `{ name, betCoin, maxPlayers }` | `{ room, wallet }` | host seated at seat 0 + stake charged; update Header coin from `wallet` |
| Join | `POST /api/rooms/:roomId/join` | `{ room, wallet }` | charge stake for a new seat; then navigate to TablePage |

- **`joiningId`** = the `roomId` currently being POSTed (locks that card's button — RoomPage already supports it).
- **Refresh the list** on mount and after create/leave. (Optional later: a lightweight `GET /api/rooms` poll, since the lobby has no socket.)
- **402 "Not enough coins"** on create/join → toast / inline error; do not navigate.
- On successful **join/create → set `activeRoom` and navigate to `/table`.**

### 2.4 TablePage / GameTable → Live match (REST join + Socket)

- **Components:** [`TablePage`](src/components/TablePage/TablePage.jsx) (`roomName`, `stake`, `onLeave`) wraps [`GameTable`](src/components/GameTable/GameTable.jsx) (`bare`, `fill`). **`GameTable` is where the real work is — see §4.**
- Lifecycle when entering TablePage:

```
1. (already done in RoomPage)  POST /rooms/:id/join         → seat + stake
2. open socket, then emit      room:join { roomId, playerId }   (playerId === user.id)
3. client auto-emits           player:ready { roomId, playerId }
4. HOST, when ready, emits      game:start { roomId, playerId, initialGameState, secondsPerTurn }
5. on my move                   game:play / game:skip { roomId, playerId, gameState, ...flags }
6. on others' moves             receive game:update  → apply to local render
7. turn timer                   receive turn:timeout → the active client auto-plays/passes
8. match over                   receive game:end     → show result → pot already settled server-side
9. leave                        emit room:leave (queued if playing) → close socket → navigate to Room
```

- **HUD:** `TablePage.roomName` ← `room.name`; `TablePage.stake` ← `room.betCoin`.
- **`onLeave`** → `room:leave` (backend queues it mid-game per §6.2) → back to Room.

---

## 3. Data-shape adapters (server ↔ our components)

The server's snapshots don't match our component props 1:1. Keep the components untouched; **adapt in the integration layer.**

### Room

| Server `RoomSnapshot` | Our `RoomCard` / RoomPage prop | Adapter |
|---|---|---|
| `roomId` | (React `key`, `room.id`) | rename `roomId → id` |
| `name` | `name` | as-is |
| `betCoin` | `betCoin` | as-is |
| `maxPlayers` | `maxPlayers` | as-is |
| `players: PlayerSnapshot[]` | `players: [{ name, avatarSrc? }]` | map each `{ name }`; drop server-only fields |
| `status` | (used for filtering / "Full") | RoomPage lists only `waiting`; `RoomCard` shows Full when `players.length === maxPlayers` |
| `hostPlayerId`, `gameState`, `version`, `turnStartedAt`, `turnDurationMs`, `pendingLeavePlayerIds` | (Table layer only) | not needed by the lobby card |

### Identity / Wallet → Header

| Server | Our Header/Home prop |
|---|---|
| `PublicUser.displayName` (or `username`) | `username` |
| `PublicUser.avatarUrl?` | `avatarSrc` |
| `Wallet.coin` | `coin` |

### Player / seat (Table)

| Server `PlayerSnapshot` `{ playerId, name, status, seatIndex, isOnline }` | Our `Table`/`GameTable` seat |
|---|---|
| `seatIndex` (0–3) | seat position — **equals our `PlayerId`; never remap** (spec §8.6) |
| `name` | `Table` player `name` |
| `isOnline` | dim/mark a disconnected seat |
| `status` | drive "waiting/playing/finished" affordances |

> **Put the adapters in one place** (`src/net/adapters.js`) so the mapping lives in exactly one spot and the components stay presentational.

---

## 4. The hard part: `GameTable` demo → real multiplayer

Today `GameTable.jsx` is a **single-player demo**: it deals all four hands locally, and drives seats 1–3 with `chooseBotMove` bots. The spec **forbids bots** (§1, §13) — every seat is a real connected user. So the online path needs a second mode.

### 4.1 What changes

| Concern | Solo demo (keep) | Online (build) |
|---|---|---|
| Seats 1–3 | local bots (`chooseBotMove`) | **remote humans** via `game:update` |
| State source | internal `useReducer` | reducer seeded by socket, **remote moves applied from `game:update`** |
| My move | dispatch locally | dispatch locally **+ emit `game:play`/`game:skip`** with the new `gameState` |
| Deal | local `deal()` | **host** deals once, sends `initialGameState` via `game:start` |
| Turn timeout | local timer auto-plays | server `turn:timeout` → **the active client** auto-plays and emits |

**Recommended shape:** keep `GameTable` as-is for solo, and add an **`online` prop** (or a thin `OnlineGameTable` wrapper) that swaps the bot effect for a socket sync layer. The reducer/engine stay identical — only *who supplies the next state* differs.

### 4.2 What travels in `gameState` (⚠ open design point)

Our `engine.js` reducer state holds **every player's hand** in one object. Broadcasting that to all clients leaks hidden information. Two viable models for v1:

- **(A) Trust model (simplest, friends/MVP):** host's engine deals; `initialGameState` contains all hands; each client renders only *its own* hand + opponents as face-down counts (our `Table` already does this). Fine for a friends table; not cheat-proof.
- **(B) Public-projection model (correct, more work):** the broadcast `gameState` is a **public projection** — current combo, `beaten` pile, per-seat card *counts*, whose turn, finished/ranked — and each client keeps its own hand private. Requires the engine to separate "public state" from "private hand," and a way to hand each player their private deal (host computes, but the relay broadcasts to everyone → needs either trust for the deal, or a per-seat secret which the thin relay doesn't do).

**Decision needed before Table integration.** Recommend **(A) for the first playable online build**, then move to **(B)**. Flagged again in §8.

### 4.3 Turn timer responsibility

- Backend runs one `setTimeout` per room and emits **`turn:timeout`** only (§7) — it never auto-plays.
- On `turn:timeout`, the **active** client runs the same auto-action our engine already has (`{ type: 'timeout' }`: lead lowest / else pass) and emits a normal `game:play`/`game:skip`.
- If the active player is disconnected, the **host** acts on their behalf (spec §7). The countdown is rendered from `turnStartedAt + turnDurationMs` (in `game:update` / room snapshot), so every client and any refreshed client show the same ring — our `TurnTimer` already animates from a duration.

---

## 5. Frontend integration layer to build (Q3, plain JS)

Small, presentational-preserving. Proposed files:

```
src/net/
  events.js       ← MIRROR of backend types/events.ts (CLIENT_EVENTS / SERVER_EVENTS). MUST stay in sync.
  api.js          ← fetch wrapper: base URL, Bearer token, unwraps { ok, data|error }, throws on !ok
  socket.js       ← socket.io-client singleton: connect(token), join(roomId), typed emit/on helpers
  adapters.js     ← RoomSnapshot↔RoomCard, user/wallet↔Header, PlayerSnapshot↔seat (see §3)
src/state/        ← lightweight stores (Zustand or context) — the Q2 seams, in JS
  auth.js         ← { user, wallet, token, login(mode,creds), logout, refreshWallet }
  rooms.js        ← { rooms, activeRoom, list(), create(), join(id), leave() }
  match.js        ← { room, gameState, version, apply(update), start(), play(), skip() }  (Table only)
src/app/
  router.jsx      ← Login → Home → Room → Table routes; guards on token
```

- **Pages stay presentational** — screens/containers wire store → props → navigation (the pattern the components were designed for).
- **`events.js` is the sync contract**: never inline event strings; copy the backend's `events.ts` values verbatim.
- Token persisted to `localStorage` so a refresh can re-auth and (on Table) refetch `GET /rooms/:id` to rebuild the board (spec §10 refresh recovery).

---

## 6. Backend module layout (TypeScript) — tailored from spec §2

```
backend/
  package.json            ← express@4, socket.io@4, zod, jsonwebtoken, tsx/ts-node, typescript
  tsconfig.json
  src/
    index.ts              ← Express + HTTP + Socket.IO bootstrap, /health, CORS
    api/
      router.ts           ← mounts /auth /users /wallet /rooms
      roomController.ts    ← REST room endpoints (orchestrates room + wallet)
    middleware/
      validate.ts         ← Zod body/params/query
      errorHandler.ts      ← terminal handler → { ok:false, error }
    modules/
      auth/                ← register/login, JWT sign/verify, hash, requireAuth
      user/                ← Map<userId,User> + PublicUser projection
      wallet/              ← Map<userId,Wallet> + credit/debit, chargeEntryFee, awardWinnings
    rooms/
      roomStore.ts         ← Map<roomId,Room>
      roomFactory.ts       ← createRoom/participant, snapshot projections, nextAvailableSeat
    services/
      roomService.ts       ← lifecycle mutations → ServiceResult (wallet-free)
    sockets/
      index.ts             ← per-connection handler registration
      roomHandlers.ts      ← room:join / leave / queue-leave / player:ready
      gameHandlers.ts      ← game:start / play / skip (+ finish/end/pot)
      disconnectHandler.ts
      turnTimer.ts         ← Map<roomId,handle>, emits turn:timeout
      emit.ts / parsePayload.ts
    types/
      index.ts             ← Room, Player, snapshots, payloads, ServiceResult
      schemas.ts           ← Zod (REST + socket)
      events.ts            ← CLIENT_EVENTS / SERVER_EVENTS  (single source of truth)
```

Adopt the spec's §4 types, §5 REST table, §6 socket table, §8 state machine, §9 pot settlement verbatim — this repo adds no new events or routes beyond that contract.

---

## 7. Build phases / milestones

**Phase 1 — Auth + Wallet + `/health` (unblocks Login & Home)**
- [ ] `backend/` scaffold: Express + TS + Zod + `/health`, envelope + error handler.
- [ ] `modules/auth` (register/login, JWT, `requireAuth`), `modules/user`, `modules/wallet` (default `coin 10_000`).
- [ ] Routes: `POST /auth/register`, `POST /auth/login`, `GET /users/me`, `GET /wallet`.
- [ ] Frontend: `src/net/api.js`, `src/state/auth.js`; wire LoginPage `onSubmit` + Home header.

**Phase 2 — Rooms (unblocks Room lobby)**
- [ ] `rooms/` + `services/roomService.ts` + `roomController.ts`; create/join charge stake, leave, list, get.
- [ ] Frontend: `src/net/adapters.js`, `src/state/rooms.js`; wire RoomPage list/create/join, CreateRoomForm.

**Phase 3 — Sockets: room presence (unblocks the Table shell)**
- [ ] `sockets/` bootstrap; `room:join`/`leave`/`queue-leave`/`player:ready`; `room:update`; disconnect/reconnect.
- [ ] Frontend: `src/net/socket.js` + `events.js` mirror; TablePage opens/joins/leaves the socket.

**Phase 4 — Game sync + timer (playable online)**
- [ ] `gameHandlers`: `game:start`/`play`/`skip`; `game:update`; `turnTimer` + `turn:timeout`; `game:end`.
- [ ] Frontend: `GameTable` **online mode** (§4) — model **(A) trust deal** first; `src/state/match.js`.
- [ ] Pot settlement on `gameOver` (§9); wallet refresh after `game:end`.

**Phase 5 — Hardening**
- [ ] Refresh recovery (`GET /rooms/:id` rebuild), reconnect flow, host transfer, queued leave.
- [ ] (Later) hidden-info model **(B)**; frontend TypeScript migration.

---

## 8. Open decisions to settle (ours specifically)

1. **Hidden hands (§4.2).** Model **(A) trust** for v1 or go straight to **(B) public projection**? Recommend (A) first. *Blocks Phase 4.*
2. **Solo mode.** Confirm `SelectMode → solo` stays 100% offline (today's bot `GameTable`) and never hits the backend. Recommend yes.
3. **`avatarSrc`.** Our `User`/`PublicUser` needs an optional `avatarUrl`; spec doesn't define one. Add it to the user projection, or omit avatars for v1?
4. **Bet amounts.** `CreateRoomForm` Slider range must match server validation (`betCoin` int ≥ 0). Confirm the Slider min/max/step and that `betCoin: 0` = free table.
5. **Reconnect UX on Table.** On refresh we refetch the room and rebuild; confirm we also re-request the *private* hand — trivial under model (A) (it's in `gameState`), non-trivial under (B).
6. **`events.js` sync.** Agree the mirror lives at `src/net/events.js` and is copied from `backend/src/types/events.ts` on every contract change.

---

## 9. Cross-references

- Authoritative server contract: **[BACKEND_SPEC.md](BACKEND_SPEC.md)** (REST §5, sockets §6, timer §7, lifecycle §8, pot §9).
- Game rules / engine (frontend-owned): `src/components/GameTable/engine.js` + GAME_RULES.md.
- Frontend flow: `LoginPage → HomePage → RoomPage → TablePage(GameTable)`.
```
