# AGENTS.md — game-component workbench

## What this project is

A **workbench** for building game UI components one at a time. Each component is
built and previewed here in isolation, then the **finished folder is copied out**
to another project (a Cambodian card game, "Teang Len"). This repo is scaffolding
— it is not the shipping app.

Two consequences drive every decision:

1. **Every component must be portable.** A component is a folder you can drag into
   another React project and it just works — no dependency on this workbench's
   shell, styles, or globals (except the few named under "Global tokens").
2. **The registry renders everything.** `src/components/registry.jsx` is the one
   file you edit to add a component to the gallery.

## Layout

```
src/
  App.jsx                     workbench shell (gallery) — rarely edit
  index.css                   Tailwind import, self-hosted font, theme tokens,
                              the font-display outline rule, keyframes
  assets/fonts/               Lilita One woff2 subsets
  assets/icons/               art the APP owns (see below)
  components/
    registry.jsx              ← the ONE file you edit to add a component
    <Name>/<Name>.jsx         one folder per component, assets co-located
```

**Where art lives — ask who owns it, not where it's used.**

- **The component's** → its folder. `AuthForm/icon_user.png`, `Table/table-background.png`.
  AuthForm's username field always has a user icon; that's part of the component.
  Co-locating is what lets the folder be dragged out whole.
- **The app's** → `src/assets/icons/`. `friend/profile/shop.png` are the *menu's*
  art, and `Footer` doesn't own the menu — it lays out whatever `items` the page
  hands it. Art for content a component merely displays belongs to the caller.

## The components

**Leaf** — imports nothing outside its own folder. Copy the folder, done.

| | |
| --- | --- |
| `Button` | chunky 3D button. `variant` lime/green/blue/red, `size` sm/md/lg, `shape` pill/circle, `outline` variant/navy, `glossy` |
| `Card` | panel surface. `variant` solid/glass |
| `Avatar` | **the** gold player frame. `size` xs/sm/md/lg, `status`, `active` |
| `PlayingCard` | one card from the deck. `rank`, `suit`, `faceDown`, `selected`, `disabled` |
| `TextField` | game input, password toggle, styled autofill |
| `Slider` | range with live readout |
| `SquareToggle` | segmented chip |
| `HintBubble` | Chakra-style tooltip, 12 placements, absolute |
| `EmoteBubble` | emoji over a profile, self-dismissing. Absolute |
| `TurnTimer` | countdown ring |

**Composite** — imports siblings, so copying it out means bringing those folders
too. This is the documented exception to the no-outside-imports rule.

| | needs |
| --- | --- |
| `Header` | Avatar — panel taps report via `onProfile`; the page opens it |
| `Table` | Avatar, EmoteBubble (+ `table-background.png`) |
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

## ⚠️ Traps

Every one of these produces **working-looking code that silently does nothing**.
They have each been hit at least once. Read before styling.

### 1. Tailwind resolves conflicts by stylesheet order, not className order

The single biggest source of bugs here. Two classes setting the same property? The
one Tailwind emits *later* wins, no matter what order you wrote them.

```jsx
// Button's root is `relative`. `.relative` is emitted AFTER `.absolute`, so:
<Button className="absolute top-4" />   // ✗ absolute is silently dropped
<span className="absolute top-4"><Button /></span>   // ✓ wrap it
```

Consequences that follow from this:

- **Never put a color, size, or shadow in a shared const** that call sites also
  set. Keep the varying property out of the base string (see `STAT` in RoomCard,
  `OUTLINE` in Slider/CreateRoomForm).
- **Never pass a position class to Button** — its root must stay `relative` so
  its slab's `absolute inset-0` has something to anchor to. Wrap it instead.
- **Two shadows on one element collide.** Stack them into one value per state
  (see `DOME` / `DOME_ACTIVE` in Avatar).
- **`hover:` variants beat base classes** on specificity — so a base
  `-translate-y-4` plus a `hover:-translate-y-2` *drops* a raised card. Suppress
  the hover conditionally (see PlayingCard).

### 2. Tailwind can't see interpolated class strings

It scans source text. If the class isn't literally in the file, it doesn't exist.

```jsx
`[&::-webkit-slider-thumb]:${KNOB}`   // ✗ attaches the variant to the FIRST class only,
                                      //   and Tailwind can't read it anyway
```

Write them out longhand, per browser, however repetitive (see Slider, FriendList's
scrollbar). Lookups into a literal map are fine — the strings are still in source.

### 3. Inline `style` outranks every class

So an inline `zIndex` kills any `hover:z-*` you also wrote. Pass dynamic numbers
as **CSS custom properties** and keep the recipe in a class:

```jsx
style={{ '--rot': `${deg}deg` }}
className="[transform:rotate(var(--rot))]"
```

This is the house pattern — `--depth` (Button), `--stroke-color` (global),
`--autofill-bg` (TextField), `--rot`/`--dy` (Hand), `--turn-duration` (TurnTimer).

### 4. Randomness in render re-rolls on every re-render

`TrickPile` scatters cards from a hash of the card's id, not `Math.random()` —
otherwise every hover in the Hand would re-shuffle the table.

## 📱 Touch first

**This game is played on phones.** Touch is the primary input, not a fallback.
Design for a thumb and let the mouse inherit it — never the reverse.

- **Every press needs visible feedback, in pure CSS.** Use `active:` — it fires on
  touch, needs no state, and can't get out of sync. `Button` sinks by `--depth`;
  `FooterItem` pops with `active:scale-110`. No `onTouchStart` bookkeeping.
- **Pair a fast in with a slower out.** `duration-200 active:duration-75`: a tap
  can be under 100ms, so a single slow duration never visibly moves before the
  finger lifts and the press reads as broken. (`active:duration-*` is a
  class+pseudo-class, so it outranks the base by specificity — no order
  dependency.)
- **Hover is not a feature.** It doesn't exist on touch, so nothing may be
  hover-only. Hover is a desktop bonus on top of a design that already works.
- **44×44px is the minimum target** (Apple HIG; Material says 48). Measure the
  **hit box**, not the ink — a 24px icon in a 44px button is fine.
- **`touch-action: manipulation` and `user-select: none`** are handled once for
  `button` / `[role=button]` / `[role=switch]` / `a` in the base layer of
  [index.css](src/index.css) — don't re-do them per component. `touch-action` is
  there for a card game's fast repeat taps (they otherwise register as
  double-tap-to-zoom), not for the old 300ms delay — the viewport meta already
  retired that. **`-webkit-tap-highlight-color` needs nothing**: Tailwind v4's
  preflight sets it transparent on `html` and it inherits.

Known targets still under 44px, if you touch these: `Button size="sm"` (37px tall)
and `shape="circle" size="sm"` (36px), `TextField`'s password toggle (24px tall),
`EmoteBar`'s buttons (36px, inherited from Button sm).

## Styling

**Tailwind only, everywhere.** No CSS files. Tailwind v4 via `@tailwindcss/vite`.
Inline `style` is for *dynamic values only* (custom properties, computed
geometry), never for styling that could be a class.

**Display font.** "Lilita One" (weight 400 only) is self-hosted in
`src/assets/fonts/` and registered as the `--font-display` theme token. Don't lean
on `font-bold` — the outline is what gives it the chunky sticker look.

**`font-display` comes with an outline.** Don't hand-roll text strokes. The base
rule in [src/index.css](src/index.css) outlines every `font-display` run; you only
name the ink:

| Class | Effect |
| --- | --- |
| `[--stroke-color:#2f5e0d]` | change the ink (default `#00376b`) |
| `[--stroke-width:0]` | opt out — small dark-on-light copy, or a card face |
| `[--stroke-width:3px]` | override the automatic scaling |

Three things baked into that rule, worth not re-breaking:

- Width is in `em` (`0.125em`) so the outline **scales with the text**.
- The stroke is centred on the glyph edge and `paint-order` paints the fill back
  over its inner half, so **only half the width shows**: `0.125em` on a 32px
  label = 4px = a 2px visible outline.
- It uses the `-webkit-text-stroke-width`/`-color` **longhands** — `var()` inside
  the `-webkit-text-stroke` shorthand silently fails to parse.

### Palette

| | |
| --- | --- |
| `#00376B` | **the ink** — Card/Header/Avatar borders, `Button outline="navy"` |
| `#1B4E86` | field navy — TextField, Slider, SquareToggle borders |
| `#2B7FC9` / `#6CC3FF` / `#1E5FA0` | panel blue (top → mid → deep) |
| `#FFD27A` / `#FFE08A` → `#FFB23E` | coin gold / the avatar gradient |
| `#9fe03a` / `#c2f051` | lime — focus rings, positive amounts |

### Global tokens (the portability exception)

These live in `index.css`, so a component using one needs it copied along:

| Token | Used by |
| --- | --- |
| `font-display` + the outline rule | everything |
| `animate-pop-in` | HintBubble, Modal |
| `animate-fade-in` | Modal backdrop |
| `animate-countdown` (+ `--turn-duration`) | TurnTimer |

`pop-in` and `fade-in` collapse to 1ms under `prefers-reduced-motion`.
**`countdown` deliberately does not** — it's information, not decoration; a
flattened countdown ring tells a player nothing. Reduced motion means less
gratuitous movement, not less meaning.

## Sizing convention

Components that live in a **list or grid own no width** — the parent sizes them,
so every card in a loop matches without being hand-sized (`RoomCard`,
`FriendList`). Components that must centre themselves in a viewport **do** own one
(`Modal`).

`Card` is the odd one: its layout defaults live in the `className` **default
value**, so passing your own *replaces* them rather than fighting them (see trap
1). The surface always applies.

### `bare` — one panel, not two

`Modal` renders a `Card`. So does any panel-shaped block. Nesting them stacks a
blue panel inside a blue panel: doubled border, doubled gradient, doubled padding.

Blocks that are meant to go inside a Modal take **`bare`**, which drops their Card
and renders the contents only — they keep their own header, so the Modal needs no
`title`:

```jsx
<Modal open={open} onClose={close}>
  <FriendList bare />     {/* likewise <Profile bare /> and <Shop bare /> */}
</Modal>
```

`CreateRoomForm` and `AuthForm` don't have it yet — render those on their own, or
add `bare` the same way.

## Adding a component

1. Create `src/components/<Name>/<Name>.jsx` (default export), assets in the folder.
2. Import it in [registry.jsx](src/components/registry.jsx) and add
   `{ name, status, notes, Component }`. Previews own any state the component needs.
3. `npm run dev`. Use the backdrop swatches (dark/light/grid) to check it against
   different game backgrounds.
4. Give it **sensible default props** so it renders standalone in the gallery.
5. Note any npm dependency beyond React in its registry `notes`.

## Verifying

There's no test runner. `npm run build` **is** the correctness check — and for any
new CSS mechanism, grep the built stylesheet to prove it actually compiled:

```bash
npm run build
grep -o "\.animate-countdown{[^}]*}" dist/assets/index-*.css
```

Do this whenever you use an arbitrary variant, a custom property, a pseudo-element,
or a new keyframe. Tailwind fails silently — it emits nothing rather than erroring.

**Don't rebuild after every edit.** This is a sample-component workbench; build when
you've used a mechanism worth verifying, not as a reflex.

## Commands

- `npm run dev` — workbench with HMR
- `npm run build` — production build (also the correctness check)
- `npm run lint` — oxlint. `registry.jsx` warns about fast-refresh (it exports the
  component array alongside previews); that one is expected.

## Stack

Vite 8, React 19.2, Tailwind v4, oxlint. react-hook-form + zod (AuthForm only).
No TypeScript, no test runner.

React 19: `ref` is a plain prop — no `forwardRef` (see TextField).
