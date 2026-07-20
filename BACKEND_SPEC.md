# BACKEND_SPEC.md — Teang Len Server Specification & Build Prompt

> **Purpose.** This document is a complete, implementation-independent specification of the Teang Len backend. Hand it to another team (or paste it as a prompt to an AI agent) and they can rebuild an equivalent server from scratch — same REST API, same socket contract, same lifecycle logic — without reading this project's source.
>
> **Read this as a build brief.** Every "MUST / MUST NOT" is a hard requirement. Sections 1–4 define the philosophy; sections 5+ define the concrete contract.

---

## 0. Build Prompt (paste this to an implementer)

> Build the backend for a real-time multiplayer Cambodian card game ("Teang Len").
> Stack: **Node.js + Express 4 + Socket.IO 4 + TypeScript**, storage is **in-memory `Map` only (no database)**.
> The backend is a **thin coordination + relay layer**: it manages accounts, wallets, rooms, seats, and socket broadcasting. It **must never contain, compute, validate, or interpret game logic** — the game engine lives entirely on the frontend and sends the backend opaque `gameState` snapshots to store and rebroadcast.
> Implement: JWT auth (register/login), an in-memory user store, an in-memory wallet (coins) with a single credit/debit money path, room lifecycle (create/join/leave/list/get), Socket.IO handlers for room + game synchronization, a per-turn server timer, disconnect/reconnect handling, and coin staking (entry fee on join, winner-takes-pot on match end).
> Follow the exact REST routes, socket events, payload schemas, and state-machine rules described in this document. Preserve the response envelope `{ ok: true, data } | { ok: false, error }` everywhere.

---

## 1. Core Philosophy — The Hard Boundary

```
Frontend engine computes the move → emits resulting gameState → backend stores it → backend broadcasts to others.
The backend NEVER computes, validates, or modifies gameState content.
```

**MUST:**
- Treat `gameState` as `unknown` / opaque at every layer. Store it. Broadcast it. Never read its fields.
- Own: identity (accounts), wallets, rooms, seats (0–3), socket channels, connection tracking, the turn timer, and money.
- Return every response as `{ ok: true, data: T }` or `{ ok: false, error: string }`.

**MUST NOT:**
- Deserialize, inspect, or branch on the contents of `gameState`.
- Add AI players, bots, or auto-fill empty seats. Every seat is a real connected user.
- Add a database or persistence layer (in-memory only).
- Trust client-declared identity for authorization — derive `userId` from the verified JWT for REST; for sockets, the `playerId` in the payload must correspond to a real room participant.

---

## 2. Module Layout (recommended)

```
backend/src/
  index.ts                  ← Express app + HTTP + Socket.IO bootstrap, /health, CORS
  api/
    router.ts               ← mounts /auth, /users, /wallet, /rooms
    roomController.ts        ← REST room endpoints (orchestrates room + wallet)
  middleware/
    validate.ts             ← Zod validation middleware (body/params/query)
    errorHandler.ts          ← terminal Express error handler
  modules/
    auth/                    ← register/login, JWT sign/verify, password hash, requireAuth
    user/                    ← in-memory user store + identity service
    wallet/                  ← in-memory wallet, credit/debit, entry fee + payout
  rooms/
    roomStore.ts             ← Map<roomId, Room>
    roomFactory.ts           ← createRoom, createParticipant, snapshot projections, helpers
  services/
    roomService.ts           ← all room lifecycle mutations (pure-ish, returns ServiceResult)
  sockets/
    index.ts                 ← io bootstrap, per-connection handler registration
    roomHandlers.ts          ← room:join / leave / queue-leave / player:ready
    gameHandlers.ts          ← game:start / game:play / game:skip (+ finish/end/pot)
    disconnectHandler.ts     ← socket disconnect → mark disconnected + broadcast
    turnTimer.ts             ← per-room setTimeout, emits turn:timeout
    emit.ts                  ← typed broadcast helpers
    parsePayload.ts          ← safe Zod parse for socket payloads
  types/
    index.ts                 ← Room, Player, snapshots, payloads, ServiceResult
    schemas.ts               ← Zod schemas (REST + socket)
    events.ts                ← CLIENT_EVENTS / SERVER_EVENTS constants
```

**Single source of truth for event names:** `types/events.ts`. Never inline socket event string literals anywhere else. The frontend keeps a mirror copy that MUST stay in sync.

---

## 3. Identity, Auth & Wallet

### 3.1 Auth (JWT)

- **Register** (`POST /api/auth/register`): create a unique-username account, hash the password, provision a wallet with default balances, return `{ token, user, wallet }`.
- **Login** (`POST /api/auth/login`): verify username + password (generic error message for either failure), return `{ token, user, wallet }`.
- **Token:** HS256 JWT, `sub = userId`, 7-day TTL. Secret from `AUTH_SECRET` env (warn + insecure dev fallback if unset). Verify signature with a timing-safe compare and check `exp`.
- **`requireAuth` middleware:** extract `Bearer <token>`, verify, attach `userId` to the request. Reject with 401 (`"Authentication required"` / `"Invalid or expired token"`). **All room, user, and wallet routes require auth.**

> **Note on identity model:** identity is a real account (username + password), not an anonymous guest. `Player.playerId === User.id`.

### 3.2 User

- In-memory `Map<userId, User>`. Enforce unique username on create.
- `PublicUser` = safe projection (no password hash). `GET /api/users/me` returns the authenticated user.

### 3.3 Wallet

- In-memory `Map<userId, Wallet>`. Currencies: `coin` (live) and `gem` (reserved). **Default new balance: `coin: 10_000, gem: 0`.**
- **All balance changes go through generic `credit()` / `debit()`** (positive-integer amounts; debit rejects on insufficient funds). This is the single auditable money path — never mutate balances directly.
- Domain helpers built on top:
  - `chargeEntryFee(userId, amount)` — debits coins on room create/join. `amount === 0` is a no-op (free table). Insufficient funds → surface as **HTTP 402** with `"Not enough coins."`.
  - `awardWinnings(userId, amount)` — credits the pot to the winner. Non-positive amount is a no-op.
  - `canAfford(userId, currency, amount)` — non-mutating pre-check.
- `GET /api/wallet` returns the authenticated user's balances (`{ coin, gem }`).
- **The wallet module knows nothing about rooms or game logic.** Room/game code calls these primitives; it never touches balances itself.

---

## 4. Domain Types

### 4.1 Player (in-room session)

```ts
type PlayerStatus = "waiting" | "ready" | "playing" | "finished" | "disconnected";

interface Player {
  playerId: string;          // === User.id
  name: string;              // User.displayName at join time
  socketId: string | null;   // null when offline
  status: PlayerStatus;
  seatIndex: number | null;  // 0–3
  connectedAt: number;
  reconnectedAt: number | null;
}
```

### 4.2 Room

```ts
type RoomStatus = "waiting" | "starting" | "playing" | "finished";

interface Room {
  roomId: string;                    // uuid
  name: string;                      // 1–24 chars
  hostPlayerId: string;              // host User.id
  betCoin: number;                   // stake per seat (0 = free table)
  players: Player[];                 // up to maxPlayers
  status: RoomStatus;
  gameState: unknown;                // OPAQUE — never interpreted
  version: number;                   // increments on every mutation
  createdAt: number;
  updatedAt: number;
  maxPlayers: number;                // 2–4
  turnStartedAt: number | null;      // epoch ms current turn timer began
  turnDurationMs: number;            // per-turn timer (default 15_000)
  pendingLeavePlayerIds: string[];   // queued departures applied at match end
}
```

### 4.3 Public snapshots (the only shapes exposed to clients)

- `PlayerSnapshot`: `{ playerId, name, status, seatIndex, isOnline }` where `isOnline = socketId !== null`.
- `RoomSnapshot`: the Room minus internal-only concerns, including `gameState`, `version`, `turnStartedAt`, `turnDurationMs`, `pendingLeavePlayerIds`.
- **Never expose `socketId` or password hashes.** Always project through snapshot functions.

### 4.4 Service result wrapper

```ts
type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: number };  // code = HTTP status
```

Services return this; controllers translate `code` into the HTTP status and `{ ok:false, error }` body.

---

## 5. REST API

Base path `/api`. Envelope: `{ ok: true, data } | { ok: false, error }`. All room/user/wallet routes require `Authorization: Bearer <token>`.

| Method | Path | Auth | Body (Zod) | Purpose |
|---|---|---|---|---|
| `GET`  | `/health` | no | — | Liveness: `{ ok, service, ts }` |
| `POST` | `/api/auth/register` | no | `{ username, password, displayName? }` | Create account + wallet, return `{ token, user, wallet }` |
| `POST` | `/api/auth/login` | no | `{ username, password }` | Return `{ token, user, wallet }` |
| `GET`  | `/api/users/me` | yes | — | Authenticated user's public profile |
| `GET`  | `/api/wallet` | yes | — | Authenticated user's balances |
| `GET`  | `/api/rooms` | yes | — | List **waiting** rooms only |
| `POST` | `/api/rooms` | yes | `{ name, betCoin, maxPlayers? }` | Create room (host seated at seat 0) + charge stake |
| `GET`  | `/api/rooms/:roomId` | yes | — | Room snapshot (used for refresh recovery) |
| `POST` | `/api/rooms/:roomId/join` | yes | — | Join room + charge stake |
| `POST` | `/api/rooms/:roomId/leave` | yes | — | Leave room |

### 5.1 Validation schemas

- **Register:** username 3–20 chars `[a-zA-Z0-9_]`; password 6–72; displayName ≤ 24 optional (defaults to username).
- **Create room:** `name` 1–24 (trimmed); `betCoin` int ≥ 0; `maxPlayers` int 2–4 (**default 4**).
- Validation middleware Zod-parses the target (`body`/`params`/`query`), replaces it with the parsed value, and forwards Zod errors to the error handler on failure.

### 5.2 Create room flow (controller orchestration)

```
1. Derive userId from JWT.
2. canAfford(userId, coin, betCoin)?  → if not, 402 "Not enough coins." (before any room is created)
3. roomService.create(userId, { name, betCoin, maxPlayers })  → host seated at seat 0, status "waiting"
4. walletService.chargeEntryFee(userId, betCoin)  → debit the host's stake now
5. 201 { room: RoomSnapshot, wallet: WalletBalances }
```

### 5.3 Join room flow

```
1. Derive userId. Fetch room snapshot (404 if missing).
2. alreadySeated = room already contains this userId.
3. If NOT alreadySeated and NOT canAfford(betCoin) → 402 "Not enough coins."
4. roomService.join(roomId, userId)   // idempotent if already seated; assigns next free seat
5. Charge entry fee ONLY for a newly-taken seat; a re-join returns current balances (no double charge).
6. 200 { room, wallet }
```

**Join rejections:** room not found (404); `status === "playing"` → `"Game already started"` (409); room full → `"Room is full"` (409); no free seat → `"No seats available"` (409).

### 5.4 Leave room flow

```
1. Derive userId. roomService.leave(roomId, userId).
2. If room becomes empty → delete the room.
3. Else if the host left → transfer host to a remaining player.
4. 200 { room }
```

> **Important:** the REST leave removes immediately. The **socket** `room:leave` is smarter — during an active game it *queues* the departure instead (see §6.2).

---

## 6. Socket.IO Contract

### 6.1 Setup

- Socket.IO server with CORS from `CLIENT_ORIGIN` (default `*`), `pingTimeout: 10000`, `pingInterval: 5000`.
- On each `connection`, register room handlers, game handlers, and the disconnect handler.
- Sockets join a **room channel named `roomId`**; all broadcasts target `io.to(roomId)`.
- Every incoming payload is Zod-parsed via a safe `parsePayload` helper; on failure, emit `error` to the sender and drop the message.
- Errors go only to the originating socket: `socket.emit("error", { message })`.

### 6.2 Client → Server events

| Event | Payload (Zod) | Handler logic |
|---|---|---|
| `room:join` | `{ roomId, playerId:uuid }` | `socket.join(roomId)`. If player already seated → **reconnect**; else **join** with this socketId. Broadcast `room:update`. |
| `room:leave` | `{ roomId, playerId }` | If room `status === "playing"` → **queue** the leave and broadcast `room:update`; do **not** remove mid-game. Otherwise `socket.leave` + `roomService.leave` + broadcast. |
| `room:queue-leave` | `{ roomId, playerId }` | Add playerId to `pendingLeavePlayerIds` (idempotent). Broadcast `room:update`. |
| `room:cancel-queue-leave` | `{ roomId, playerId }` | Remove from `pendingLeavePlayerIds`. Broadcast `room:update`. |
| `player:ready` | `{ roomId, playerId }` | Set player `status = "ready"`. Broadcast `room:update`. |
| `game:start` | `{ roomId, playerId, initialGameState, secondsPerTurn? }` | **Host only.** Set room `playing`, store `initialGameState`, mark players `playing`. Start turn timer (clamp `secondsPerTurn` to **[5,120]s**, ×1000). Broadcast `room:update` + `game:update`. |
| `game:play` | `{ roomId, playerId, gameState, playerFinished?, finishedRank?, gameOver?, rankings? }` | Store gameState, bump version. If `gameOver` → clear timer; else restart. Broadcast `game:update`. If `playerFinished` → mark finished + `player:finished`. If `gameOver` → settle pot, `game:end`, `endGame()` + `room:update`. |
| `game:skip` | `{ roomId, playerId, gameState }` | Store gameState, restart timer, broadcast `game:update`. |

### 6.3 Server → Client events

| Event | Payload | Meaning |
|---|---|---|
| `room:update` | `{ room: RoomSnapshot }` | Authoritative room state changed. |
| `game:update` | `{ roomId, gameState, version, triggeredBy, turnStartedAt? }` | New game snapshot. Apply only if `triggeredBy !== myPlayerId`; use `version` to discard stale. |
| `turn:update` | `{ roomId, currentPlayerId, version }` | (Reserved) highlight active seat. |
| `turn:timeout` | `{ roomId }` | Current turn's timer expired — clients decide the auto-action. |
| `player:finished` | `{ roomId, playerId, rank }` | A player emptied their hand. |
| `game:end` | `{ roomId, rankings, gameState }` | Match over; `rankings: {playerId, rank}[]`. |
| `player:disconnected` | `{ roomId, playerId }` | A player's socket dropped. |
| `error` | `{ message }` | Sent to the offending socket only. |

### 6.4 Authorization rules at the socket layer

- `game:start` — reject unless `room.hostPlayerId === playerId` (403), room not already `playing` (409), and `players.length >= 2` (409 `"Need at least 2 players"`).
- `game:play` / `game:skip` — reject unless the room is `playing` and `playerId` is a seated participant (403). The backend does **not** check whose turn it is.

---

## 7. Turn Timer

- One `setTimeout` per room, tracked in a module-level `Map<roomId, handle>` **outside** the Room object.
- `startTurnTimer(io, roomId, durationMsOverride?)`: clear any existing timer, compute `durationMs`, and if `> 0`, record `turnStartedAt = Date.now()` on the room, set the timeout, return `turnStartedAt`. On fire → `io.to(roomId).emit("turn:timeout", { roomId })`.
- Restart on `game:start`, `game:play` (unless `gameOver`), `game:skip`. **Clear** on game over.
- Include `turnStartedAt` in `game:update`; refreshed clients recover it from the room snapshot.
- Default `turnDurationMs = 15_000`. Host override via `game:start.secondsPerTurn`, clamped **[5,120]s**.
- **The backend does not auto-play on timeout.** It only emits `turn:timeout`; the responsible client performs the auto-play/auto-skip and emits a normal `game:play`/`game:skip`.

---

## 8. Room Lifecycle State Machine

### 8.1 `startGame(roomId, hostPlayerId, initialGameState)`
Guards: room exists; caller is host; not already playing; ≥ 2 players. Set `status: "playing"`, store `initialGameState`, clear `turnStartedAt` and `pendingLeavePlayerIds`, set every player `status: "playing"`, bump version.

### 8.2 `applyGameState(roomId, playerId, gameState)`
Guards: room exists; `status === "playing"`; `playerId` is a participant. Store `gameState` opaquely, bump version.

### 8.3 `markPlayerFinished(roomId, playerId)`
`rank = (count of players already "finished") + 1`. Set that player `status: "finished"`. If all finished → room `status: "finished"`.

### 8.4 `endGame(roomId)` (after `game:end`)
Remove all `pendingLeavePlayerIds`. If none remain → delete room (return `null`). Else reset survivors to `status: "waiting"`, clear `gameState` and `turnStartedAt` and pending list, keep host if present else transfer to first survivor.

### 8.5 Host transfer rule
Whenever the host is removed, new host = the original host if still present, otherwise the first remaining player.

### 8.6 Seat assignment
`nextAvailableSeat`: lowest index in `[0, maxPlayers)` not already taken. Host is always seat 0. `seatIndex` equals the frontend engine's `PlayerId` — do not remap.

### 8.7 Versioning
Every room mutation goes through `bumpVersion` (`version + 1`, `updatedAt = now`).

---

## 9. Pot Settlement (money at match end)

```
On gameOver (game:play with gameOver + rankings):
  1. Read room snapshot → betCoin, players.
  2. If betCoin <= 0 → no-op (free table).
  3. winner = rankings.find(r => r.rank === 1).
  4. pot = betCoin * players.length.
  5. walletService.awardWinnings(winner.playerId, pot).
  6. THEN broadcast game:end.
```

---

## 10. Disconnect & Reconnect

- **Disconnect:** mark player `status: "disconnected"`, `socketId: null`, broadcast `player:disconnected` + `room:update`. Seat retained.
- **Reconnect:** client re-emits `room:join` on `connect`. If already seated → restore `socketId`, set `reconnectedAt`, flip back to `playing`/`waiting`.
- **Refresh recovery:** client refetches `GET /api/rooms/:roomId` and rebuilds game + timer state.

---

## 11. Error & Response Conventions

- **Envelope everywhere:** `{ ok: true, data }` or `{ ok: false, error }`.
- **Status codes:** 200, 201, 400 validation, 401 auth, 402 insufficient coins, 403 forbidden, 404 not found, 409 conflict.
- **Terminal error handler:** Zod → 400; else 500. Never leak stack traces or `socketId`.
- **Socket errors:** emit `error` `{ message }` to the sender only.

---

## 12. Configuration / Environment

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP + Socket.IO port |
| `CLIENT_ORIGIN` | `*` | CORS origin for REST + sockets |
| `AUTH_SECRET` | insecure dev fallback (warns) | JWT HMAC secret — **set in production** |

Constants: JWT TTL 7 days; default wallet `coin 10_000`; default `turnDurationMs 15_000`; turn clamp `[5,120]s`; room name 1–24; username 3–20; password 6–72; `maxPlayers` 2–4.

---

## 13. Non-Negotiable Rules

- [ ] `gameState` is `unknown` at every layer; backend never reads it.
- [ ] No database — all state in in-memory `Map`s.
- [ ] No AI, no bots, no auto-fill; every seat is a real user.
- [ ] Only the host can `game:start`; requires ≥ 2 players.
- [ ] All money flows through wallet `credit`/`debit`; entry fee on join, winner-takes-pot on end.
- [ ] Response envelope `{ ok, data | error }` on every REST + socket error path.
- [ ] Socket event names come only from the shared `events.ts` constants.
- [ ] `seatIndex` (0–3) == frontend `PlayerId`; never remap.
- [ ] Every room mutation bumps `version`.
- [ ] Leaving mid-game is queued, not immediate; applied at match end.
- [ ] Host transfers on host departure; empty room is deleted.
- [ ] Turn timer restarts on start/play/skip, clears on game over; backend only emits `turn:timeout`.
- [ ] Snapshots never leak `socketId` or password hashes.

---

## 14. Known Cross-Doc Notes

- The engine/game rules are **frontend-owned** (`src/components/GameTable/engine.js` + GAME_RULES.md). The backend only relays their results.
- Identity is account-based JWT auth (`/api/auth/register` + `/login`), not anonymous guest.
