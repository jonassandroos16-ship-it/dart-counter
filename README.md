# Dart Counter

A full-featured dart scoring app built with **React + TypeScript + Vite**. Tracks scores, stats, XP, levels, titles, badges, power-ups, battle mode, and includes synthesized sound effects, voice packs, and background music.

Live demo: https://jonassandroos16-ship-it.github.io/dart-counter/

---

## Table of Contents

1. [Features](#features)
2. [Quick Start](#quick-start)
3. [For Developers Coming From C++ or C#](#for-developers-coming-from-c-or-c)
4. [Project Architecture](#project-architecture)
5. [How the App Works](#how-the-app-works)
6. [How to Add Things](#how-to-add-things)
   - [Add a New Game Mode](#add-a-new-game-mode)
   - [Add a New Title](#add-a-new-title)
   - [Add a New Badge](#add-a-new-badge)
   - [Add a New Power-Up](#add-a-new-power-up)
   - [Add a New Voice Pack](#add-a-new-voice-pack)
   - [Add a New Showdown Background](#add-a-new-showdown-background)
7. [How to Change Views (Navigation)](#how-to-change-views-navigation)
8. [Common React Bugs and How to Fix Them](#common-react-bugs-and-how-to-fix-them)
9. [Build, Test, Deploy](#build-test-deploy)
10. [Instructions for AI Assistants Updating This README](#instructions-for-ai-assistants-updating-this-readme)

---

## Features

### Game Modes
- **501 / 301 / 701 / 101** — Classic x01 with optional Double Out
- **Around the Clock** — Hit 1 through 20 and Bull in order
- **Practice** — Free scoring, no rules
- **Killer** — Hit your number 5 times to become a Killer, then knock out opponents
- **Speed 101** — Race to zero, fastest checkout wins
- **High Score** — 7 visits of 3 darts, highest total wins
- **Battle** — HP-based combat using player attributes (health/armor/power); each dart deals damage independently; last one standing wins
- **Team Mode** — Any of the above can be played as team vs team (2–4 teams)

### Progression
- **XP and leveling** — Earn XP from wins, visits, checkouts, and darts thrown
- **70+ built-in titles** — From "First Win" to "Dart Legend", with custom title creation
- **30+ badges** — In-game medals (Ton, Hat Trick, Slayer), post-game comparative awards (Top Scorer, Clutch, Comeback Kid), and a dedicated power-up badge pool (Fully Charged, Unleashed, Wall Builder, Surge Rider, Thief, Cold Snap, Lucky Hand, Saved, Quad Squad)
- **Player attributes** — Health (base 100, cap 500), armor (flat per dart, cap 25), power (flat per dart, cap 30) used in Battle mode
- **Power-ups** — 7 power-ups (Fourth Dart, Blocker, Reroll, Surge, Steal, Freeze, Lucky Miss) that charge from doubles/triples/bullseyes
- **Showdown backgrounds** — 10 selectable gradient backgrounds for the match intro animation
- **Showdown stat titles** — Per-player highlight titles in the showdown intro (Top Scorer, Ton Master, Maximum King, Checkout Master, Winner, Fast Starter, Sharpshooter, The Finisher, Veteran) — each fires only when exactly one player leads that metric, plus a Champion crown for the highest-level player

### Stats and History
- 3-dart average, first 9 average, 180s, 140+, 100+, high score, high checkout
- Win rate, tie rate, legs won, darts thrown
- Battle mode stats: kills, times KO'd, battle games
- Best/worst/average finish
- Scoring distribution bar chart
- Dartboard heatmap showing where darts land
- Average-over-time line chart (Daily / Weekly / Monthly / Yearly)
- Player comparison (side-by-side stat comparison)
- Badge display with lifetime earn counts
- Match history with visit-by-visit detail
- Date filtering and mode filtering for all stats

### Audio
- Synthesized sound effects (no audio files needed) via Web Audio API
- 5 voice packs (Off, Announcer, Cyborg, Hype, Female) — formant-based speech synthesis
- 6 background music tracks (setup + match contexts)
- Player entrance sounds (Hero, Villain, Cyborg, Mystic, Beast, Champion)

### UI/UX
- Dark/light themes with 8 accent colors
- Full-screen no-scroll play layout
- Showdown intro animation with player-selected backgrounds, champion crown, and per-player stat titles
- Score popups, milestone popups, level-up popups, title-unlock popups, kill popups
- Compact circular PowerUpOrb with charge ring + 4th-dart slot indicator
- Responsive design (mobile to desktop)
- Cloud sync via Supabase (optional — works fully offline with localStorage)
- Per-player Developer mode toggle for testing power-ups and battle attributes

---

## Quick Start

```bash
npm install
npm run dev      # start dev server (Vite)
npm run build    # production build to dist/
npm run test     # run vitest test suite
npm run typecheck # tsc --noEmit
```

The app deploys to GitHub Pages automatically on push to `main` (see `.github/workflows/deploy.yml`). The CI workflow runs `npm run typecheck` and `npm test` before building.

---

## For Developers Coming From C++ or C#

If you know C++ or C# but haven't used React before, here's the mental model:

### React in 60 Seconds

- **React is a UI tree.** Components are functions that return JSX (HTML-like syntax in JS). The framework calls your component function, renders the result, and diffs it against the previous render to update only what changed (the "virtual DOM").
- **State drives re-renders.** `useState` returns `[value, setter]`. Calling the setter with a new value triggers a re-render of that component and its children. This is very different from C++ where you'd mutate a struct field and redraw manually.
- **Never mutate state directly.** Always call the setter with a *new* object/array. React checks reference equality to decide what changed. `arr.push(x)` then `setArr(arr)` does NOT trigger a re-render because the array reference is the same.
- **Props are read-only.** A component receives `props` (like function parameters) from its parent. To change data, the parent passes a callback prop (e.g. `onChange`) that the child calls.
- **useEffect runs after render.** `useEffect(fn, [deps])` runs `fn` after the DOM is painted, and re-runs it when `deps` change. Use it for syncing to localStorage, fetching, audio, etc. — NOT for deriving data (use `useMemo` for that).
- **useMemo caches a computed value.** `useMemo(() => expensiveCalc(a, b), [a, b])` recomputes only when `a` or `b` change.
- **TypeScript is strict.** Types are checked at build time but erased at runtime. Interfaces (`interface`) are like C++ structs with no memory layout. `type` is similar but more flexible (unions, intersections).

### Key Differences From C++

| C++ / C# | React / TypeScript |
|---|---|
| `class Foo { int x; }` then `foo.x = 5;` | `const [x, setX] = useState(0); setX(5);` |
| Manual `delete` / RAII | Garbage collected; components unmount when removed from the tree |
| `#include` | `import` / `export` (ES modules) |
| `std::vector<T>` | `T[]` or `Array<T>` |
| `nullptr` | `null` or `undefined` (both exist; `undefined` = not set, `null` = explicitly empty) |
| `map<K,V>` | `Record<K,V>` or `Map<K,V>` |
| Templates | Generics: `function foo<T>(x: T): T` |
| `void f(int& x)` (out param) | `f(setX)` — pass a callback, not a reference |

### Why the UI Sometimes Doesn't Update

The #1 React bug: **mutating state instead of replacing it.** If you see stale UI, check whether you wrote `player.xp += 10; setPlayers(players)` instead of `setPlayers(players.map(p => p.id === id ? { ...p, xp: p.xp + 10 } : p))`. See [Common React Bugs](#common-react-bugs-and-how-to-fix-them) below.

---

## Project Architecture

```
src/
├── App.tsx                # Root component — nav, view switching, global effect, audio unlock
├── main.tsx               # Entry point — mounts <App/> to #root
├── index.css              # Global styles + CSS variables (theme, accent, spacing)
├── types.ts               # All TypeScript interfaces (Player, Game, Settings, etc.)
├── constants.ts           # Game modes, titles, showdown backgrounds, checkout table, defaults
├── logic.ts               # Pure game logic: createGame, recordFromGame, stats, XP, battle damage
├── badges.ts              # Badge definitions, lifetime aggregations, and award logic
├── powerups.ts            # Power-up definitions and apply hooks (returns PowerUpResult)
├── sound.ts               # Web Audio synthesis — SFX, voice packs, entrance sounds
├── music.ts               # Background music engine (looped synthesized tracks)
├── store.ts               # State management — useDB hook, localStorage, Supabase sync
├── supabase.ts            # Supabase client init
├── Popups.tsx             # Toast, Modal, MilestonePopup, LevelUpPopup, TitleUnlockPopup, KillPopup
├── PlayView.tsx           # Router only — picks the right play/* module based on game state
├── PlayersView.tsx        # Player CRUD — name, color, title, badge, attributes, power-ups, showdown bg, dev mode
├── StatsView.tsx          # Stats dashboard — charts, badges, comparisons, battle stats
├── HistoryView.tsx        # Match history list with detail view
├── SettingsView.tsx       # Settings — theme, sound, XP config, power-up scaling, custom titles, sync
├── Charts.tsx             # LineChart, BarChart, DartboardHeatmap (SVG-based)
├── CalendarPicker.tsx     # Date filtering for stats
└── play/                  # Play flow split out of the former 1605-line PlayView.tsx
    ├── SetupView.tsx      # Setup form (mode, players, legs, double-out, teams, power-ups)
    ├── Showdown.tsx       # Pre-match intro screen with champion crown + stat titles
    ├── GameOver.tsx       # Post-match summary + badge award display
    ├── BattleVisitOverlay.tsx # Animated per-dart damage overlay shown during a Battle visit
    ├── common.tsx         # PowerUpOrb + AttributeStrip shared UI
    ├── dart.tsx           # Shared addDartToGame + KeypadPad helpers
    ├── powerups.ts        # Charge + activate helpers (enforces 1-dart rule, ok flag)
    ├── rewards.ts         # XP, badges, milestones, title unlock popups
    ├── finish.ts          # finishSimpleGame helper
    └── boards/
        ├── X01Board.tsx       # 301/501/701/101 + practice + teams
        ├── AtcBoard.tsx      # Around the Clock
        ├── KillerBoard.tsx   # Killer elimination
        ├── HighScoreBoard.tsx # High Score party mode
        └── BattleBoard.tsx   # Battle attributes mode
```

### Data Flow

```
App.tsx
  └─ useDB() ──── localStorage ──── Supabase (optional cloud sync)
       │
       ├─ players: Player[]
       ├─ games: GameRecord[]
       ├─ settings: Settings
       └─ activeGame: Game | null
              │
              ▼
       PlayView (router) → SetupView / Showdown / <Mode>Board / GameOver
              │
              ▼
       On game finish → recordFromGame() → setGames() → persisted + synced
```

All state lives in the `useDB` hook in `store.ts`. Components read via props and write via callbacks. There is no Redux or context — just one hook at the top.

`PlayView.tsx` is now a thin router that delegates to the `play/` package based on the current game phase (setup → showdown → board → game over). The five board components in `play/boards/` each share the `addDartToGame` + `KeypadPad` helpers from `play/dart.tsx`.

---

## How the App Works

### Game Lifecycle

1. **Setup** — `play/SetupView.tsx` shows the setup form (mode, players, legs, double-out, team mode, power-ups).
2. **Create** — `createGame()` in `logic.ts` builds a `Game` object with all per-player state (score, visits, lives, HP, charge, etc.).
3. **Showdown** — `play/Showdown.tsx` renders the pre-match intro: champion crown for the highest-level player, per-player stat titles (Top Scorer, Ton Master, …), accent chips for level/title/badge/power-up, and the chosen showdown background.
4. **Play** — Players tap dart buttons; the active board component updates `game.darts`, then on "Enter visit" calls `commitVisit()` which appends to `game.players[turn].visits`, applies power-up charge via `play/powerups.ts`, handles busts, and advances the turn.
5. **Leg/Game end** — When a player checks out (or all visits used in High Score, or last one standing in Battle/Killer), `recordFromGame()` snapshots the game into a `GameRecord` and pushes it to `games` via `setGames()`.
6. **XP/Titles/Badges** — After a game, `play/rewards.ts` computes XP earned, checks all title conditions in `allTitles()`, checks badges via `computeGameBadges()`, and updates the player object. Popups fire for new unlocks.

### Battle Mode

Battle mode uses player attributes (Health, Armor, Power) for HP-based combat:
- Each player starts with HP equal to their Health attribute (base 100, cap 500).
- **Per-dart damage formula**: `(dartValue + power) − armor`, with a minimum of 1 damage on any successful hit.
- Armor is a flat reduction applied to EVERY dart in a visit (base 0, cap 25).
- Power is a flat bonus added to EVERY dart that hits (base 0, cap 30).
- Misses deal 0 damage — power only applies on successful hits.
- Surge power-up doubles each dart's value for damage purposes (mirroring the score multiplier).
- When a player attacks, the `BattleVisitOverlay` animates each dart's damage individually, showing the formula, draining the target's HP bar in steps, and shaking the target card with intensity proportional to the damage dealt.
- Reduce an opponent to 0 HP to defeat them; last player standing wins.

### State Persistence

- **localStorage** is the source of truth offline. Keys: `dc_players`, `dc_games`, `dc_settings`, `dc_active_game`, plus tombstone keys for delete propagation.
- **Supabase** (optional) mirrors state to a Postgres `app_state` row + `games` table. The `useDB` hook debounces writes (800ms) and merges on pull using `mergeBackup()`. Tombstones ensure deletes propagate across devices.
- **activeGame** stays local-only so two concurrent matches on different devices don't clash.

### Power-Ups

Power-ups are defined in `src/powerups.ts`. Each `apply` hook returns a `PowerUpResult` with an optional `ok` flag — when `ok === false` (e.g. Reroll with no darts, Steal with no opponents) the caller in `play/powerups.ts` does NOT consume the charge. Activation also requires at least one dart thrown in the current visit (prevents instant activation at visit start). When a power-up is used, per-player `_usedX` flags are set so `recordFromGame()` can persist `usedPowerUp` on the `GameRecord` — this powers the power-up-specific badge awards.

### Badges

Badges live in `src/badges.ts`. Each `BadgeDef` has a `kind` of `in-game` (per-player, earned during the match) or `post-game` (comparative, one winner per match). A `powerUpOnly` flag separates the badge pool: when power-ups are enabled in a match, standard badges are suppressed and the power-up-only badges (Fully Charged, Unleashed, Wall Builder, Surge Rider, Thief, Cold Snap, Lucky Hand, Saved, Quad Squad) become available. This keeps the two pools mutually exclusive.

### Audio

All audio is synthesized at runtime via the Web Audio API — no `.mp3` or `.wav` files. `sound.ts` builds oscillators, formant filters, and envelopes to produce SFX, voice, and entrance sounds. `music.ts` loops scheduled note patterns for background tracks. Browsers require a user gesture (click/keydown) before audio can play, so `App.tsx` attaches a one-time `pointerdown`/`keydown` listener to unlock the AudioContext.

---

## How to Add Things

### Add a New Game Mode

1. **`src/constants.ts`** — Add an entry to the `MODES` record:
   ```ts
   'mymode': {
     start: 0, label: 'My Mode',
     desc: 'Description shown in the mode picker.',
     rules: ['Rule 1', 'Rule 2'],
     // Optional flags: atc?, practice?, killer?, party?
   },
   ```
2. **`src/logic.ts`** — If your mode has custom start logic (like Killer assigning numbers, or Battle reading attributes), add a branch in `createGame()`.
3. **`src/play/boards/`** — If your mode needs a custom board (like `KillerBoard` or `BattleBoard`), add a new board component and wire it into the render switch in `PlayView.tsx`. Otherwise the default `X01Board` works for x01-style modes.
4. **`src/StatsView.tsx`** — The mode filter buttons are generated from `MODE_KEYS`, so your mode appears automatically.
5. Test by selecting it in the setup screen.

### Add a New Title

Titles are in `src/constants.ts` in the `BUILTIN_TITLES` array. Each title has a `check` function:

```ts
{
  id: 'my_title',                      // unique id
  name: 'My Title',
  desc: 'Hit three T20s in one visit',
  icon: '🎯',
  check: (allVisits, gameVisits, game, ctx) => {
    // allVisits: player's visits in this game
    // gameVisits: same as allVisits (alias)
    // game: the Game object
    // ctx: { playerId, games, gamesPlayed, gamesWon, lifetimeVisits }
    return gameVisits.some(v => (v.darts||[]).filter(d => d.base === 20 && d.mult === 3).length >= 3);
  },
  // Optional: progress bar for lifetime titles
  // progress: (ctx) => ({ current: ..., target: ... }),
},
```

- **In-game titles** use `gameVisits` (current match).
- **Lifetime titles** use `ctx.lifetimeVisits` (all history) and `ctx.games`, `ctx.gamesPlayed`, `ctx.gamesWon`.

After adding, the title appears in the Players view title picker once earned. The `retroUnlockAll` function in `logic.ts` backfills lifetime titles from existing history on app load.

### Add a New Badge

Badges are in `src/badges.ts` in the `BADGES` array:

```ts
{
  id: 'b_my_badge',
  name: 'My Badge',
  desc: 'Description shown on hover',
  icon: '🔥',
  kind: 'in-game',           // or 'post-game'
  check: (playerVisits, game) => {  // only for 'in-game'
    return playerVisits.some(v => v.scored >= 200);
  },
  // For 'post-game' badges, use `pick` instead of `check`:
  // pick: (game) => playerId | playerId[] | null
  // Optional: lifetime context value shown when equipped
  // context: (playerId, games) => number | string | null,
  // contextLabel: 'my stat',
  // Optional: set powerUpOnly: true to restrict the badge to power-up matches
  // (standard badges are disabled when power-ups are on)
  // powerUpOnly: true,
},
```

- **`in-game`** badges can be earned by multiple players in the same match.
- **`post-game`** badges are comparative — only one player (or tied players) earn them per match.
- **`powerUpOnly: true`** badges only fire in matches where power-ups were enabled; standard badges (`powerUpOnly` unset/false) are suppressed in those matches.
- The `context` function shows a lifetime counter on the equipped badge (e.g. "42 kills").

### Add a New Power-Up

Power-ups are in `src/powerups.ts` in the `POWER_UPS` array:

```ts
{
  id: 'pu_my_powerup',
  name: 'My Power-Up',
  icon: '⚡',
  desc: 'Description shown in the popup.',
  apply: (game, curIdx) => {
    // Mutate and return the game, plus a user-facing message.
    // Return { ...game, ..., message, ok: false } to signal a failed
    // activation — the caller will NOT consume the charge in that case.
    const players = game.players.map((pl, i) =>
      i === curIdx ? { ...pl, /* your effect */ } : pl
    );
    return { game: { ...game, players }, message: 'My Power-Up activated!' };
  },
},
```

The `apply` function runs from `play/powerups.ts` `activatePowerUp()` when the player taps "Use Power-Up" in the `PowerUpOrb` popup. It receives the current `game` and the activating player's index. Return a new game object (don't mutate the input) and a toast message. Set `ok: false` to abort without consuming the charge.

If your power-up needs a persistent flag during the match (like `_fourthDart`), set it on the player in `apply` and read it in the relevant board component in `play/boards/`. The `activatePowerUp` helper in `play/powerups.ts` already sets `powerUpUsed: true`, resets charge to 0, and records a `_usedX` flag (e.g. `_usedBlocker`, `_usedSurge`, `_usedSteal`, `_usedFreeze`, `_usedReroll`, `_usedLuckyMiss`, `_usedFourthDart`) so `recordFromGame()` can persist `usedPowerUp` on the `GameRecord` for power-up-specific badges.

### Add a New Voice Pack

Voice packs are in `src/sound.ts`. Find the `VOICE_PACKS` record and add an entry:

```ts
my_pack: {
  label: 'My Pack',
  base: 110,           // base pitch in Hz
  formants: [[600, 1100, 2700]],  // formant frequencies for vowel clarity
  bright: 0.3,         // 0..1 — higher = brighter/harsher
  speed: 1.0,          // speech speed multiplier
  vibrato: 0,          // 0..1 — pitch wobble amount
  gain: 0.9,           // output gain
},
```

Then add the id to `VOICE_PACK_LIST` so it appears in Settings. The `playVoiceByName` function synthesizes phonemes through formant filters — tweak `base`, `formants`, and `speed` to change the character. The Announcer pack uses `base: 95`, clearer formants, and `speed: 1.6` for intelligibility.

### Add a New Showdown Background

Showdown backgrounds are in `src/constants.ts` in the `SHOWDOWN_BGS` array:

```ts
{ id: 'mybg', label: 'My BG', css: 'radial-gradient(circle at 50% 40%, #1a2a3a 0%, #0a0c12 70%)' },
```

The `css` field is any valid CSS `background` value (gradients work best). Players pick from these in the Players view; each player's chosen background renders on their own showdown card. The `showdownBgFor()` and `showdownBgCssForId()` helpers resolve which background to show.

---

## How to Change Views (Navigation)

Navigation is controlled by a single `view` state in `App.tsx`:

```tsx
type View = 'play' | 'players' | 'stats' | 'history' | 'settings';
const [view, setView] = useState<View>('play');
```

The `NAV` array defines the bottom nav bar. To add a new view:

1. Add the id to the `View` type union.
2. Add an entry to `NAV` with an icon from `lucide-react`.
3. Add a render branch in `App.tsx`'s JSX: `{view === 'myview' && <MyView ... />}`.
4. Create `src/MyView.tsx` exporting a component that receives the props it needs (typically `players`, `games`, `settings`, and setter callbacks from `useDB`).

Views are conditionally rendered (not routed via URL), so there's no router config. The bottom nav buttons call `setView(id)` on click.

---

## Common React Bugs and How to Fix Them

### 1. UI Not Updating After a Change

**Cause:** You mutated state instead of replacing it.

**Bad:**
```tsx
player.xp += 50;
setPlayers(players);  // same array reference — React skips re-render
```

**Good:**
```tsx
setPlayers(players.map(p =>
  p.id === id ? { ...p, xp: (p.xp || 0) + 50 } : p
));
```

**Rule:** Always create a new object/array when calling a setter. Use `.map()`, `.filter()`, or spread (`{...obj}`) to create new references.

### 2. Stale Closure in useEffect/useCallback

**Cause:** The callback captures an old value of a variable.

**Bad:**
```tsx
useEffect(() => {
  const id = setInterval(() => console.log(count), 1000);
  return () => clearInterval(id);
}, []);  // count is always the initial value
```

**Good:**
```tsx
const countRef = useRef(count);
countRef.current = count;
useEffect(() => {
  const id = setInterval(() => console.log(countRef.current), 1000);
  return () => clearInterval(id);
}, []);
```

Or include `count` in the deps array if you want the effect to re-run when it changes.

### 3. Infinite Re-render Loop

**Cause:** An effect updates state unconditionally, triggering itself.

**Bad:**
```tsx
useEffect(() => {
  setPlayers enriched(players);  // runs every render → setPlayers → re-render → runs again
}, [players]);
```

**Good:** Guard with a ref or a condition:
```tsx
const done = useRef(false);
useEffect(() => {
  if (done.current) return;
  done.current = true;
  setPlayers(enriched(players));
}, [players]);
```

The app uses this pattern in `App.tsx` for the retroactive title backfill.

### 4. List Items Reorder or Lose State

**Cause:** Missing or non-unique `key` prop in a list.

**Bad:** `<div>{items.map(item => <Row data={item} />)}</div>`

**Good:** `<div>{items.map(item => <Row key={item.id} data={item} />)}</div>`

Keys must be stable and unique. Don't use the array index as key if the list can reorder.

### 5. Conditional Hook Calls

**Cause:** Hooks (useState, useEffect, etc.) called inside a condition or after an early return.

**Bad:**
```tsx
if (!players.length) return <Empty />;
const [x, setX] = useState(0);  // ← hook after conditional return
```

**Good:** Move hooks above any early returns:
```tsx
const [x, setX] = useState(0);
if (!players.length) return <Empty />;
```

React requires hooks to run in the same order on every render. The `PowerUpOrb` component in `play/common.tsx` is an example — it returns `null` for non-power-up games *after* its `useState` call.

### 6. Modal/Popup Not Closing on Outside Click

**Cause:** The backdrop click handler checks the wrong target.

The `Modal` component in `Popups.tsx` does it correctly:
```tsx
<div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
```

This only closes when the click lands on the backdrop itself (not its children), so clicking inside the modal content doesn't dismiss it.

### 7. Audio Not Playing

**Cause:** Browser autoplay policy. AudioContext starts suspended until a user gesture.

`App.tsx` handles this with a one-time `pointerdown`/`keydown` listener that calls `Sound.unlock()` and `musicRef.current.unlocked = true`. If audio is silent, check that this listener fired (it removes itself after the first gesture).

### 8. Type Errors After Adding a Field

**Cause:** TypeScript interfaces are strict. If you add a field to a type, all places that construct that type need the field (or it must be optional with `?`).

When adding a new field to `Player`, `Game`, or `Settings`:
- Add it to `src/types.ts` as an optional field (`field?: Type`) if old data might not have it.
- Add a default in `defaultSettings()` (in `constants.ts`) for new Settings fields.
- Update `loadSettings()` in `store.ts` to merge the new field with defaults.
- For Supabase-backed fields, the merge functions in `store.ts` (`mergePlayers`, `mergeSettings`) should handle missing fields gracefully.

### 9. Build Fails After Changes

Run `npm run typecheck` to see all type errors at once. Run `npm run lint` for ESLint warnings. The most common build failures are:
- Unused imports (ESLint error in this config)
- Missing `key` props in lists
- Type mismatches (e.g. passing `string` where `number` expected)
- Using a hook conditionally (see #5 above)
- Narrowing union types without a discriminator (e.g. `s.kind === 'player'` before accessing `s.level` — see the showdown accents block in `play/Showdown.tsx`)

### 10. Cloud Sync Not Working

- Check `src/supabase.ts` — if the env vars aren't set, `supabase` is `null` and the app runs in local-only mode (this is fine for development).
- The Settings view shows sync status: "Local storage only" means no database configured; "Offline" means the database is unreachable; "Pending" means local changes haven't pushed yet.
- Tombstones (deleted player/game ids) propagate deletes. If a delete isn't syncing, check that `setPlayers`/`setGames` in `store.ts` is recording the tombstone correctly.

### 11. Power-Up Charge Consumed on a Failed Activation

**Cause:** The `apply` hook returned `ok: false` but the caller still zeroed the charge.

The `activatePowerUp` helper in `play/powerups.ts` checks `ok === false` and returns `null` without touching `powerUpCharge`. If you add a new power-up whose `apply` can fail, return `ok: false` in that branch — do not consume the charge yourself.

---

## Build, Test, Deploy

```bash
npm run dev        # Vite dev server with HMR
npm run build      # vite build → dist/
npm run typecheck  # tsc --noEmit (fast type check)
npm run lint       # ESLint
npm run test       # vitest run (unit tests in *.test.ts)
npm run test:watch # vitest in watch mode
```

Tests live alongside source: `src/logic.test.ts` and `src/badges.test.ts`. Add new tests there when you add logic to `logic.ts` or `badges.ts`.

Deployment is automatic via `.github/workflows/deploy.yml` — pushing to `main` runs typecheck + tests, builds, and deploys to GitHub Pages.

---

## Instructions for AI Assistants Updating This README

When an AI assistant (Claude, Copilot, Cursor, etc.) modifies this codebase, it MUST also update this README in the same commit/PR so the documentation never drifts from the code. This is a **non-negotiable** part of any change to this repo.

### When you MUST update the README

Update the README whenever any of the following change:

1. **Features** — A mode, title, badge, power-up, voice pack, showdown background, stat, or audio track is added, removed, renamed, or has its behavior changed. Be specific — list the new item by name in the relevant Features bullet.
2. **"How to Add" sections** — The data model for titles, badges, power-ups, or voice packs changes. The code snippets in those sections must stay byte-accurate: if `BadgeDef` gains a field (e.g. `powerUpOnly`), update the example; if `PowerUpResult` gains an `ok` flag, update the example and the prose.
3. **Project Architecture** — A source file is added, removed, renamed, or moved between directories. Keep the tree and the one-line descriptions in sync. The `play/` package and `play/boards/` subpackage must stay accurate.
4. **Data Flow diagram** — The state management approach changes (e.g. adding a context, switching to Redux, adding a new store key, or splitting a view into submodules).
5. **Common React Bugs** — You encounter and fix a new class of bug during your work. Add it as a numbered entry with a clear "Cause" / "Bad" / "Good" structure (or "Cause" / "Fix" for non-code bugs).
6. **Build/Test/Deploy** — Scripts in `package.json` change, or the CI workflow (`.github/workflows/deploy.yml`) changes.
7. **Any public-facing behavior** — If a user of the live app would notice the change, the README should reflect it.

### How to update the README

1. **Read the current README first.** Use the GitHub API or `Read` tool — don't rewrite from memory.
2. **Make targeted edits.** Prefer editing the affected section over rewriting the whole file. The README is intentionally cumulative and educational.
3. **Keep the Table of Contents in sync** with the section headings. If you add a section, add it to the TOC.
4. **Keep code snippets accurate.** Copy real signatures from the source — don't paraphrase. If `BadgeDef` has `powerUpOnly?: boolean`, the example must show it.
5. **Keep it readable for a C++/C# developer.** When explaining React concepts, frame them in terms a systems programmer would understand (references, mutation, lifecycles).
6. **Do not remove sections.** If a section becomes obsolete, mark it as such rather than deleting it.

### Verification before pushing

Before committing, verify that the README still describes a working, building project:

1. Run `npm run typecheck` — must pass.
2. Run `npm run test` — must pass.
3. Run `npm run build` — must succeed.
4. Re-read the sections you edited and confirm every code snippet, file path, and function name matches the actual source.
5. Confirm the Table of Contents still matches the section headings.

### Committing

- **Commit the README in the same push as the code changes.** The README and the code should never be out of sync on `main`. Do not push code in one commit and "fix the README later" in another.
- Use a commit message that mentions the README update, e.g. `feat: add Freeze power-up + docs: sync README`.
- If you are an AI agent making a series of commits, the final commit in the series MUST include any README updates needed by the earlier commits. Never leave `main` with code that the README doesn't reflect.

### Quick checklist for every PR

- [ ] Features section lists any new/changed feature by name
- [ ] "How to Add" snippets match the real interfaces in `types.ts`, `badges.ts`, `powerups.ts`, `constants.ts`
- [ ] Project Architecture tree matches `src/` (including `play/` and `play/boards/`)
- [ ] Data Flow diagram still matches the actual state flow
- [ ] Common React Bugs section includes any new bug class you encountered
- [ ] `npm run typecheck`, `npm run test`, and `npm run build` all pass
- [ ] Table of Contents matches the section headings
- [ ] README is committed in the same PR as the code changes
