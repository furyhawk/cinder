# Project CINDER — Implementation Plan (Saved Reference)

**Source date:** 2026-11-14  
**Purpose:** Persistent in-repo copy of the game plan for future sessions.

## 1) Operating contract

1. Workstreams are ordered (`W0`–`W9`) and must follow dependency order in `status.json`.
2. Use listed defaults when ambiguous; only escalate if impossible in the environment.
3. A workstream is complete only when its gate command passes.

## 2) Product scope

- Vertical slice: browser twin-stick shooter.
- Core loop: move/aim/fire + Surge dash (invincible + damaging).
- One biome (`Foundry`), one boss (`Warden`), 8 enemy archetypes.
- Progression: 12-node upgrade tree, 2 decks × 8 cards.
- Difficulty tiers: easy/normal/hard.
- Session target: 12–18 minutes.
- Restart target: <= 1.5 seconds.

### Non-goals (v1.0)

No multiplayer, no netcode, no cloud save, no extra biomes/bosses, no localization, no achievements/store/level editor.

## 3) Architecture constraints

- Deterministic fixed-step simulation at 60 Hz.
- `src/sim/` must be pure and must not import rendering/audio/UI/Pixi.
- `WorldState` must be JSON-serializable.
- Use seeded, named RNG streams (`spawn`, `cards`, `boss`, `arena`, `cosmetic`).

## 4) Key success criteria (M5)

- Frame time p95 <= 16.6 ms at 900 entities.
- Restart latency <= 1.5 s.
- Determinism: same replay input => same hashes across runs.
- On-ramp: >= 60% first-time players beat boss within 4 attempts.
- Readability: no top complaint of “couldn’t see what killed me”.
- Median successful run: 12–18 min.

## 5) Required repository layout

Use this structure as canonical:

- `docs/` (`CONTRACT.md`, `handoff/W0..W9.md`, `decisions/ADR-*`)
- `src/sim/` (pure simulation + replay/hash/rng)
- `src/data/` (JSON-only tuning/content)
- `src/render/`, `src/audio/`, `src/ui/`, `src/telemetry/`
- `tests/unit/`, `tests/sim/`, `tests/e2e/`
- `tools/` (`soak.ts`, `balance.ts`, `build-report.ts`)
- `assets/manifest.json`, `status.json`, `.github/workflows/ci.yml`

## 6) Workstreams and gates

### W0 — Foundations and determinism harness
- Scaffold TS + Vite + renderer + tests.
- Enforce import boundaries and determinism lint rules.
- Build headless soak harness.
- **Gate:** `pnpm verify` (project now uses Bun; equivalent: `bun run verify`).

### W1 — Simulation core
- Fixed-step loop, entity store, collision broadphase, damage pipeline.
- Event queue + replay recording/hash protocol.
- **Gate:** `pnpm test:sim` + `pnpm sim:replay`.

### W2 — Player, feel, camera
- Movement, Surge timing/i-frames/cooldown, primary fire, input buffering.
- Camera shake + hit-stop.
- **Gate:** feel e2e + frame budget.

### W3 — Enemies, director, waves
- 6 behavior classes, 8 archetypes, threat-budget spawner, wave data.
- Projectile color separation/readability law.
- **Gate:** wave sim tests + archetype completeness.

### W4 — Mutating arena
- Polygon mutation, 3 layouts, telegraph system, safety invariant.
- **Gate:** arena sim tests + no trap states in soak.

### W5 — Boss framework + Warden
- Data-driven boss runtime, 5 patterns, module exposure windows.
- Generation scaling (Gen2 via data only).
- Fairness validator invariants.
- **Gate:** boss fairness tests pass.

### W6 — Progression
- XP/token loop, 12-node upgrades, 2 decks x 8 cards, chain multiplier.
- Unlock causality visibility.
- **Gate:** progression tests + balance CSV generation.

### W7 — Presentation/Juice
- Pooled particles (hard cap), impact feedback, post effects, audio, HUD.
- Contrast/readability auditing.
- **Gate:** visual e2e + frame budget.

### W8 — Difficulty/Onboarding/Telemetry
- Data-only difficulty deltas, first-90s teaching flow, telemetry schema.
- 200-run bot balance sweep per difficulty.
- Restart timing path.
- **Gate:** balance targets + telemetry validation.

### W9 — Hardening/RC
- 10-min soak/perf/memory, replay corpus, accessibility toggles, cross-browser validation.
- Final build report (S1–S6 verdicts).
- **Gate:** all verification gates green.

## 7) Milestone sequence

- **M0:** engine alive (debug canvas/tick/entity/frame overlay)
- **M1:** shooter feel validated
- **M2:** full run loop playable (waves->boss->death->restart)
- **M3:** content-complete slice with presentation layer
- **M4:** tuned difficulties + telemetry evidence
- **M5:** release candidate

## 8) Determinism protocol (must keep)

Replay records must store:
- `seed`, `buildHash`, `inputs[]`, `hashes[]` (regular intervals)

Any divergence must be investigated (iteration order, time source leaks, random source leaks, event ordering). Do not loosen hashes without an ADR.

## 9) Session protocol (execution discipline)

Each session:
1. Read `status.json` + latest handoff.
2. Pick lowest-numbered ready workstream.
3. Run gate first (expect fail if not done).
4. Implement one task.
5. Validate acceptance.
6. Commit with gate/bench/handoff refs.
7. Update `status.json`; if gate passes, mark done + write handoff.

## 10) Traceability highlights

Core plan decisions explicitly preserve:
- Two-verb design (fire + surge only).
- Boss/module fairness and readability.
- Arena mutation with anti-cheap-death safety checks.
- Data-driven tuning/content additions without code edits.
- Playability and readability over visual noise.

