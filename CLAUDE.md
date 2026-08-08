# CLAUDE.md — game-component workbench

> Canonical guide for this repo (structure, conventions, styling traps, games,
> commands). `AGENTS.md` points here — edit this file, not that one.

## What this is

A **workbench** for building game UI components in isolation; each finished **folder
is copied out** to another project (a Cambodian card game, "Teang Len"). This repo is
scaffolding, not the shipping app. Two rules follow:

1. **Every component is portable** — a folder you can drag into another React project
   with no dependency on this workbench's shell/styles/globals (except "Global tokens").
2. **`src/components/registry.jsx` is the one file you edit** to add a component.

## Layout

```
src/
  index.css                   Tailwind import, self-hosted font, theme tokens,
                              font-display outline rule, keyframes
  main.jsx                    tiny entry chunk → Preloader → AppRoot
  assets/fonts/               Lilita One woff2 subsets
  assets/icons/               art the APP owns
  components/
    registry.jsx              ← the ONE file you edit to add a component
    <Name>/<Name>.jsx         one folder per component, assets co-located
  games/                      one folder per CARD GAME
    contract.js               the game-module interface
    index.js                  registry: id → lazy import
    teanglen/                 engine.js, match.js, Board.jsx, index.js
    kanteal/                  + verify.mjs (rule checks), analyse.mjs (balance)
  workbench/Workbench.jsx     the gallery shell (/component) — rarely edit
  app/                        app shell: router, AppRoot, Preloader, global overlays
  pages/                      ONE FILE PER ROUTE — <Name>Screen.jsx, composition only
  features/                   feature logic too big/specific for a page: auth/,
                              friends/, table/ (channels, TableLayout, hooks)
  api/                        TanStack Query hooks (use<Domain>.js) + keys.js + client.js
  services/                   transport + one function per endpoint (no React)
  stores/                     zustand: session, appError, invites
  hooks/ utils/               cross-feature helpers
```

**The data path is one direction, always:**

```
pages/<Name>Screen.jsx  →  api/use<Domain>.js  →  services/<domain>.js  →  services/http.js
   composition only        cache policy only      one fn per endpoint      fetch + envelope
```

- A **page** holds no `fetch`, no query key and no cache call. If it grows past
  composing components + calling hooks, the logic belongs in `features/<name>/`.
- **`api/`** owns keys, staleness and invalidation — nothing else. Every key comes
  from [api/keys.js](src/api/keys.js); never write `['wallet']` at a call site.
- **`services/`** is plain async functions, callable outside React (that's how the
  cold-boot room recovery and the auto-guest sign-in reuse them).
- **`stores/`** is for state that outlives a screen (session, global error, invites).
  Server data belongs in `api/`, and UI state belongs in the component.

`src/pages/<Name>Screen.jsx` is the ROUTE; `src/components/<Name>Page/` is a
presentational layout the route renders. Different things, hence the different
suffixes — don't collapse them.

**Art ownership — ask who owns it, not where it's used:**
- **Component's** → its folder (`AuthForm/icon_user.png`, `Table/table-background.png`).
  Co-locating is what lets the folder drag out whole.
- **App's** → `src/assets/icons/` (the menu's friend/profile/shop art — `Footer` only
  lays out whatever `items` the page hands it). Art for content a component merely
  displays belongs to the caller.

## Components

**Leaf** — imports nothing outside its own folder.

| | |
| --- | --- |
| `Button` | 3D button. `variant` lime/green/blue/red, `size` sm/md/lg, `shape` pill/circle, `outline` variant/navy, `glossy` |
| `Card` | panel surface. `variant` solid/glass |
| `Avatar` | the gold player frame. `size` xs/sm/md/lg, `status`, `active` |
| `PlayingCard` | one card. `rank`, `suit`, `faceDown`, `selected`, `disabled` |
| `TextField` | game input, password toggle, styled autofill |
| `Slider` | range with live readout |
| `SquareToggle` | segmented chip |
| `HintBubble` | tooltip, 12 placements, absolute |
| `EmoteBubble` | emoji over a profile, self-dismissing, absolute |
| `TurnTimer` | countdown ring |
| `Notice` | the one message pill. `tone` error/success/neutral, `size` sm/md/lg. Never positions itself — wrap it |

**Composite** — imports siblings, so copying it out means bringing those folders too
(the documented exception to the no-outside-imports rule).

| | needs |
| --- | --- |
| `Header` | Avatar — panel taps report via `onProfile`; page opens it |
| `Table` | Avatar, EmoteBubble (+ `table-background.png`). Seats up to 8 — see Trap 5 |
| `EmoteBar` | Button |
| `Footer` | Card, Button — the menu (`items`) is the page's, art and all |
| `RoomCard` | Card, Button, Avatar |
| `FriendList` | Card, Button, Avatar |
| `Profile` | Card, Avatar, Button |
| `Shop` | Card, Button |
| `Chat` | Card, Button, Avatar, TextField |
| `Modal` | Card, Button (+ `react-dom` portal) |
| `ResultModal` | Modal, Avatar, Button |
| `Hand` | PlayingCard |
| `TrickPile` | PlayingCard |
| `CreateRoomForm` | Card, Button, TextField, Slider, SquareToggle |
| `AuthForm` | Card, Button, TextField, HintBubble (+ `react-hook-form`, `zod`, `@hookform/resolvers`) |

## 🃏 Games

One folder each under `src/games/`. The layer they share is the **component library**,
not an engine.

| game | rules |
| --- | --- |
| `teanglen` | Teang Len / Tiến Lên — shedding, combos, tricks, ranks every finisher |
| `kanteal` | Kanteal (កន្ទេល) — one card per turn, cycles, elimination, one winner. 2–8 players. NO central pile: played cards stay in front of their owner all game (`Table`'s `playAreas`). §6 successful-beat rule: you must WIN a completed cycle before you may finish — reaching ≤2 cards with none (`successfulBeats[seat] === 0`) cuts you; a beat that's beaten back counts for nothing (banked at cycle end, see `failsBeatGate`) |

A game module exports one object: `meta`, `createMatch`, `Board`, `bot`, `summarize`
(see [src/games/contract.js](src/games/contract.js)). **Keep the interface this small** —
don't promote game functions (`classify`, `canBeat`, `suggestSelection`) into a shared
"card engine"; they're specific to *shedding* games. The shell only needs: how many
seats, give me a board, autoplay this seat, who won.

Two properties not to break:
- **The backend never reads `gameState`** — it's `unknown` at every layer and the server
  just fans it out, so a new game needs no backend game logic. Flip side: `state` must be
  plain JSON (no Map/Set, no class instances) — it's relayed over a socket.
- **The registry holds loaders, not modules** — each game is its own Rollup chunk, so a
  phone downloads only the game being played.

### Adding a game
1. `src/games/<id>/`: `engine.js` (rules), `match.js` (turn flow), `Board.jsx` (whole
   in-room screen), `index.js` (contract object).
2. Register loader + catalogue entry in [src/games/index.js](src/games/index.js).
3. Add the entry to **[backend/src/config/games.ts](backend/src/config/games.ts)** — the
   *authority* for seat counts, turn duration, rule variations (anything a client could
   forge). The client `catalogue` only lets the lobby list games without downloading them.
4. Nothing else — rooms/seats/presence/host-transfer/AFK/spectators are game-agnostic.

A rules engine earns a **verification script**: `node src/games/kanteal/verify.mjs` walks
the spec section by section, then soaks the state machine with random games (every game
terminates, cards conserved). Where a spec leaves a rule open, a **balance script**
`node src/games/kanteal/analyse.mjs` sweeps tuning knobs and reports elimination/win rates.

`GameTable` is the one **game-bound** gallery component (offline Teang Len demo with bots
→ imports `src/games/teanglen/engine.js`; copying it out brings that folder too).

## ⚠️ Traps — each produces working-looking code that silently does nothing. Read before styling.

**1. Tailwind resolves conflicts by stylesheet order, not className order.** The class
Tailwind emits *later* wins, whatever order you wrote them.
```jsx
<Button className="absolute top-4" />              // ✗ Button root is `relative`, emitted AFTER `.absolute` → dropped
<span className="absolute top-4"><Button /></span> // ✓ wrap it
```
- Never put a color/size/shadow in a shared const that call sites also set (`STAT` in
  RoomCard, `OUTLINE` in Slider/CreateRoomForm).
- Never pass a position class to Button — its root must stay `relative` so its slab's
  `absolute inset-0` has an anchor. Wrap it.
- Two shadows on one element collide — stack into one value per state (`DOME`/`DOME_ACTIVE`
  in Avatar).
- `hover:` beats base classes on specificity — base `-translate-y-4` + `hover:-translate-y-2`
  *drops* a raised card; suppress the hover conditionally (PlayingCard).

**2. Tailwind can't see interpolated class strings** — it scans source text.
```jsx
`[&::-webkit-slider-thumb]:${KNOB}`  // ✗ variant attaches to the FIRST class only; unreadable anyway
```
Write them longhand, per browser (Slider, FriendList scrollbar). Lookups into a literal
map are fine — the strings are still in source.

**3. Inline `style` outranks every class** — an inline `zIndex` kills any `hover:z-*`. Pass
dynamic numbers as CSS custom properties, recipe in a class:
```jsx
style={{ '--rot': `${deg}deg` }} className="[transform:rotate(var(--rot))]"
```
House pattern: `--depth` (Button), `--stroke-color` (global), `--autofill-bg` (TextField),
`--rot`/`--dy` (Hand), `--turn-duration` (TurnTimer).

**4. Randomness in render re-rolls on every re-render.** `TrickPile` scatters cards from a
hash of the card's id, not `Math.random()`.

**5. On a crowded ring, lay things out *beside* each other — don't co-ordinate positions.**
`Table` places 5–8 seats on a computed ellipse; free-placing each seat's face-down card
can't be made to work (pulled in, it lands on the top seats' name pills; skewed along the
arc, on the next seat's coin line — ~9px vertical budget for a 68px card). Fix: on the ring
`opponentHands[i]` renders as a **flex sibling of its seat** (felt-facing side, mirroring
`OPP_HAND_POS`), so a card can never overlap its seat; the wider ~116px pair dropped
`RING.rx` 45→40. Reach for sibling-not-coordinate whenever two absolutely-positioned things
keep colliding.

## 📱 Touch first — played on phones; touch is primary, mouse inherits.

- Every press needs visible feedback in **pure CSS** via `active:` (fires on touch, no
  state) — Button sinks by `--depth`, FooterItem `active:scale-110`.
- Pair a fast in with a slower out: `duration-200 active:duration-75` (a tap can be <100ms;
  `active:duration-*` outranks base by specificity).
- **Hover is not a feature** — never hover-only; it's a desktop bonus.
- **44×44px minimum target** — measure the hit box, not the ink.
- `touch-action: manipulation` + `user-select: none` are handled once for
  `button`/`[role=button]`/`[role=switch]`/`a` in index.css's base layer — don't redo them.
  `-webkit-tap-highlight-color` needs nothing (preflight sets it transparent on `html`,
  inherits).
- Known sub-44px if you touch them: `Button size="sm"` (37px), `shape="circle" size="sm"`
  (36px), TextField password toggle (24px), EmoteBar buttons (36px).

## Styling

**Tailwind only, no CSS files** (v4 via `@tailwindcss/vite`). Inline `style` = dynamic
values only (custom properties, computed geometry), never styling that could be a class.

**Display font** "Lilita One" (weight 400) self-hosted in `src/assets/fonts/`, registered
as `--font-display`. Don't use `font-bold` — the outline gives the chunky sticker look.

**`font-display` carries an outline** (base rule in [index.css](src/index.css)) — don't
hand-roll strokes; name only the ink:

| Class | Effect |
| --- | --- |
| `[--stroke-color:#2f5e0d]` | change ink (default `#00376b`) |
| `[--stroke-width:0]` | opt out (small dark-on-light copy, card faces) |
| `[--stroke-width:3px]` | override the automatic scaling |

Baked in, don't re-break: width in `em` (`0.125em`, scales with text); stroke centred on the
glyph edge + `paint-order` paints fill over its inner half (only half shows: `0.125em` on
32px = 4px = 2px visible); uses `-webkit-text-stroke-width`/`-color` **longhands** (`var()`
in the `-webkit-text-stroke` shorthand silently fails to parse).

### Palette

| | |
| --- | --- |
| `#00376B` | **the ink** — Card/Header/Avatar borders, `Button outline="navy"` |
| `#1B4E86` | field navy — TextField, Slider, SquareToggle borders |
| `#2B7FC9` / `#6CC3FF` / `#1E5FA0` | panel blue (top → mid → deep) |
| `#FFD27A` / `#FFE08A` → `#FFB23E` | coin gold / the avatar gradient |
| `#9fe03a` / `#c2f051` | lime — focus rings, positive amounts |

### Global tokens (the portability exception — in index.css, copy along)

| Token | Used by |
| --- | --- |
| `font-display` + the outline rule | everything |
| `animate-pop-in` | HintBubble, Modal |
| `animate-fade-in` | Modal backdrop |
| `animate-countdown` (+ `--turn-duration`) | TurnTimer |

`pop-in`/`fade-in` collapse to 1ms under `prefers-reduced-motion`; `countdown` deliberately
does NOT — it's information, not decoration.

## Sizing

List/grid components **own no width** (the parent sizes them: RoomCard, FriendList);
viewport-centring ones **do** (Modal). `Card` puts its layout defaults in the `className`
**default value**, so passing your own *replaces* them rather than fighting them (Trap 1);
the surface always applies.

**`bare`** — a Modal renders a Card, so nesting a Card-shaped block doubles
border/gradient/padding. Blocks meant for a Modal take `bare` (drops their Card, keeps their
header): `<Modal><FriendList bare /></Modal>` (also `Profile`, `Shop`). CreateRoomForm and
AuthForm lack it — render those on their own, or add it the same way.

## Adding a screen — copy the table

[pages/TableScreen.jsx](src/pages/TableScreen.jsx) is the reference implementation.
It reads top-to-bottom as composition; everything it used to inline sits beside it:

| | |
| --- | --- |
| [features/table/TableLayout.jsx](src/features/table/TableLayout.jsx) | screen chrome — backdrop, safe-area HUD corners, room/bet pill, board layer. Shared with [SoloTableScreen](src/pages/SoloTableScreen.jsx) |
| [features/table/useAutoStart.js](src/features/table/useAutoStart.js) | the countdown + the host's deal |
| [features/table/useLeaveTable.js](src/features/table/useLeaveTable.js) | the "leave after this hand" toggle |
| [features/table/useRoomChannel.js](src/features/table/useRoomChannel.js) | the room's socket link |

The rules that generalise:
- **Slots, not props-for-everything.** `TableLayout` takes `hudLeft`/`hudRight` nodes.
  The wrapper owns the positioning so a caller never passes a position class down
  (Trap 1 — `Button`'s root is `relative`, and an `absolute` handed to it is dropped).
- **A screen's cohesive lump becomes a hook in `features/`**, named for the behaviour
  (`useLeaveTable`), not for the screen.
- **Chrome shared by two screens becomes a `features/<name>/<Name>Layout.jsx`** — not a
  `components/` entry, since it knows about safe areas and app data and isn't portable.

## Adding a component
1. `src/components/<Name>/<Name>.jsx` (default export), assets in the folder.
2. Import in [registry.jsx](src/components/registry.jsx) + add `{ name, status, notes,
   Component }`; previews own any state.
3. `npm run dev`; check against dark/light/grid backdrops.
4. Sensible default props so it renders standalone.
5. Note any npm dependency beyond React in the registry `notes`.

## Verifying

No test runner — `npm run build` **is** the correctness check. For any new CSS mechanism,
grep the built stylesheet to prove it compiled (Tailwind fails silently — emits nothing
rather than erroring):
```bash
npm run build
grep -o "\.animate-countdown{[^}]*}" dist/assets/index-*.css
```
Do this for any arbitrary variant, custom property, pseudo-element, or keyframe.
**Don't rebuild after every edit** — build when you've used a mechanism worth verifying.

## Commands
- `npm run dev` — workbench with HMR
- `npm run build` — production build (also the correctness check)
- `npm run lint` — oxlint (registry.jsx's fast-refresh warning is expected)

## Stack

Vite 8, React 19.2, Tailwind v4, oxlint. react-hook-form + zod (AuthForm only). No
TypeScript, no test runner. React 19: `ref` is a plain prop — no `forwardRef` (TextField).
