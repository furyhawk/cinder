# Agent Workflow Guide

This guide is for future coding agents working on Cinder. Read it before making
changes, then read the specific docs and tests for the subsystem you are
touching.

## Project Snapshot

Cinder is a browser-based twin-stick shooter built with TypeScript, Vite, Bun,
and the Canvas 2D API. The simulation is deterministic and runs at a fixed 60 Hz.
Keep simulation code renderer-free.

Primary references:

- `README.md` - player-facing controls and project overview.
- `docs/cinder-implementation-plan.md` - product scope and milestones.
- `docs/sektori-competitive-design-reference.md` - design research.
- `.github/instructions/deterministic-sim.instructions.md` - mandatory
  simulation rules.
- `CHANGELOG.md` - user-visible changes and released versions.

## First Checks

Use Bun 1.4+ and work from the repository root.

```bash
bun install
bun run test
bun run typecheck
bun run lint
```

For a full pre-submit gate:

```bash
bun run verify
```

`verify` runs lint, typecheck, all tests, deterministic replay, soak,
restart-latency, and a production build. A change that affects the simulation is
not complete until this gate passes.

Useful focused commands:

```bash
bun run test:unit
bun run test:sim
bun run sim:replay --ticks 2000
bun run sim:soak --ticks 1000 --entities 120
bun run restart:latency --iterations 200
bun run report:build
```

Run the app with:

```bash
bun run dev
```

The development server normally uses `http://localhost:4173/`.

Production container validation:

```bash
docker compose config
docker compose up --build -d
docker compose down
```

The Compose deployment serves the built app through Nginx on port `8787` by
default (`CINDER_PORT` overrides the host port).

## Repository Map

- `src/main.ts` - Canvas setup, UI, input, title screen, game loop, HUD, and
  presentation wiring.
- `src/sim/world.ts` - authoritative world state, fixed-step simulation, combat,
  progression, enemy spawning, and world APIs.
- `src/sim/systems/` - director, chain, collision, and damage systems.
- `src/sim/entities/` - enemy movement behavior.
- `src/sim/arena/` - arena geometry, layout data, mutation, and safety checks.
- `src/sim/boss.ts` - data-driven boss runtime.
- `src/sim/loop.ts` - fixed-step accumulator.
- `src/render/` - render-adjacent pure helpers such as camera and telegraphs.
- `src/audio/` - synthesized sound effects, music, and sim-event mapping.
- `src/ui/` - pointer hitboxes, title-screen state, and gamepad mapping.
- `src/telemetry/` - NDJSON telemetry and run IDs.
- `src/data/` - tuning and content JSON.
- `tests/unit/` - pure helpers and UI mapping tests.
- `tests/sim/` - deterministic simulation and content-contract tests.
- `tests/e2e/` - feel and integration invariants.
- `tools/` - replay, soak, balance, performance, and reporting scripts.

Do not edit `node_modules/` or generated `dist/` output. `dist/` is ignored by
Git.

## Deterministic Simulation Rules

- Call `world.step()` only from the fixed-step game loop. Never step the world
  directly from a DOM/input event handler.
- Queue one-shot player intents and consume them on simulation ticks.
- All simulation behavior must be deterministic for the same seed and inputs.
- Do not use `Math.random`, `Date.now`, or `performance.now` inside `src/sim/`.
  Use the seeded RNG in `src/sim/rng.ts`.
- When iterating mutable entity arrays, handle splices safely by decrementing
  the loop index when an entry is removed.
- Read current state immediately before using it; stale references after
  splices are a known source of crashes.
- Preserve numeric behavior carefully. Floating point changes can alter replay
  hashes and balance.

## Current Gameplay Architecture

- The game opens on a title screen. Simulation stays paused until the player
  starts with Enter/Space, pointer input, or controller A/Start.
- Gamepad right-stick aiming auto-fires. Controller A is confirm/UI input.
- Surge dashes along the aim direction, grants temporary invulnerability, and
  damages enemies along the path.
- Enemy waves spawn inside the active arena after a visible 600 ms warning. The
  warning suppresses movement and contact damage. Spawn points are distributed
  with deterministic farthest-point sampling.
- Progression uses five fixed axes: Speed, Shields, Missiles, Blaster, and
  Surge. Axis costs scale by level and are ordered Speed (cheapest) through
  Surge (most expensive).
- Axis upgrades are shown in a compact bottom bar and do not pause the
  simulation. Controller A immediately buys the selected axis.
- The old card/deck system is shelved. Do not reintroduce card offers without an
  explicit product request.

## Testing Expectations

- Bug fixes should include a regression test that fails before the fix.
- Pure logic belongs in unit tests. Deterministic world behavior belongs in
  `tests/sim/`.
- Keep test fixtures typed against exported interfaces when possible.
- For UI-only behavior, add a pure helper test if practical. Otherwise verify
  the live app in a browser.
- Canvas is fixed at 1280x720; HUD and axis-bar hitboxes must match their
  rendered coordinates.
- After gameplay changes, run `bun run verify`, not only `bun run test`.

## Browser Verification

For visual or input-flow changes, run the dev server and check the live canvas.
Headless Chrome can be used for screenshots and DevTools evaluation. The app
exposes `window.__cinderDebug` with `world`, `runtime`, `mouse`, and `audio` when
loaded with `?debug`.

Check at minimum:

- The title screen appears and starts correctly.
- HUD and bottom axis bar are readable and inside the canvas.
- Keyboard and controller input still work.
- No console errors occur.

## Change Checklist

1. Read the relevant source and tests first.
2. Reproduce the bug or establish the current behavior.
3. Make the smallest coherent change that solves the request.
4. Add or update regression coverage.
5. Run focused tests while iterating.
6. Run `bun run verify` before submitting.
7. Update `README.md`, `CHANGELOG.md`, or data files when behavior or controls
   change.
8. Check `git status` and `git diff --check`; avoid unrelated edits.

## Release Workflow

Releases use semantic-ish versioning and annotated Git tags. For a release:

1. Update `package.json` and `CHANGELOG.md`.
2. Regenerate `docs/BUILD_REPORT.md` with `bun run report:build`.
3. Run `bun run verify`.
4. Commit as `chore(release): vX.Y.Z`.
5. Create an annotated tag: `git tag -a vX.Y.Z -m "Cinder vX.Y.Z - ..."`.
6. Push the branch and tag.
7. Create a GitHub release with `gh release create`.
8. Confirm CI succeeds for both the branch and tag.

## Communication

Report what changed, what was verified, and any remaining caveats. Do not claim a
browser or gameplay check was performed unless it actually was.
