# Changelog

All notable changes to Cinder are documented here.

## [0.2.0] - 2026-11-14

### Added

- Synthesized Web Audio sound effects for firing, hits, enemy deaths, Surge,
  pickups, boss phase/pattern/module events, arena mutations, upgrades, menus,
  victory/defeat, and restart.
- `N` mute toggle and an audio status indicator in the HUD.
- Procedural 120 BPM background music synchronized to the 60 Hz simulation
  tick, with kick, snare, hi-hat, bass, and an added boss lead layer. Music
  pauses and resumes with simulation decision points.

## [0.1.0] - 2026-11-14

First playable vertical slice.

### Added

- Deterministic 60 Hz simulation with replay hashing, seeded RNG streams, and
  headless soak/performance tooling.
- Twin-stick keyboard/mouse controls plus standard-mapping gamepad support:
  left-stick/D-pad movement, right-stick aim, trigger/`A` fire, `B`/bumper
  Surge, D-pad upgrade selection with `A` confirm, and `Start` restart.
- Player movement, primary fire, Surge dash with i-frames and cooldown refund,
  input buffering, camera shake, hit-stop, and reduced-motion mode.
- Ten enemy archetypes: drone, runner, orbiter, charger, turret, spinner,
  splitter, lancer, weaver, and bomber. Weaver adds zig-zag pursuit; bomber adds
  an armoured radial burst.
- Threat-budget wave director, Foundry wave pacing, and eight enemy behavior
  classes with silhouette/readability invariants.
- Mutating arena with three layouts, three-cue telegraphs, safe-layout gating,
  and deterministic entity relocation.
- Data-driven Warden boss runtime with five patterns, exposed-module weak
  points, core armour, event streams, Generation 2 hard-mode scaling, and a
  fairness validator.
- XP upgrade offers, two eight-card decks, card runtime hooks, chain multipliers,
  deterministic card application, and a paused upgrade-selection flow.
- Telemetry session framework, difficulty tiers, restart-latency measurement,
  and generated build reports.
- Player-facing README and unit/simulation/e2e coverage for core invariants.

### Fixed

- Off-screen enemy spawns now move through an entry phase into arena-safe
  positions instead of freezing behind the wall.
- Projectile lifetime is measured in milliseconds, allowing ranged combat
  across the arena instead of expiring after roughly 75 px.
- Aim is calculated from the player's current position rather than the fixed
  canvas center.
- Upgrade selection closes immediately and spends the full XP threshold;
  simulation pauses while the upgrade overlay is open.
- LAN/dev-server startup no longer depends on secure-context-only
  `crypto.randomUUID`.

### Verification

- `bun run verify`: lint, typecheck, 72 tests, deterministic replay, soak,
  restart latency, and production build all passing.

[0.1.0]: https://github.com/furyhawk/cinder/releases/tag/v0.1.0
[0.2.0]: https://github.com/furyhawk/cinder/releases/tag/v0.2.0
