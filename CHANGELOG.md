# Changelog

All notable changes to Cinder are documented here.

## [0.7.0] - 2026-11-14

### Added

- Standard waves are now composed of three sequential mini-waves. Clearing a
  group queues the next with a short inter-group beat, and the full wave clears
  only after the final group is defeated.
- Added a HUD indicator for mini-wave progress and inter-group countdowns,
  along with `mini_wave` simulation events and an audio cue for later groups.

### Changed

- The spawn director now reserves enough threat for each mini-wave to contain
  multiple enemies, keeping groups readable instead of collapsing into a single
  expensive enemy.
- Increased Warden core and module health by 10x across both generations for a
  substantially longer boss encounter.

### Verification

- `bun run verify`: lint, typecheck, 128 tests, deterministic replay, soak,
  restart latency, and production build all passing.

## [0.6.0] - 2026-11-14

### Added

- Added a GitHub Actions Docker Hub publish stage that runs after the full
  verification job succeeds on `main` or `v*` tags, using cached Buildx layer
  builds and branch, SHA, semantic-version, and `latest` image tags.
- Added a shared neon vector CRT theme with cyan, purple, pink, and amber
  accents over a dark phosphor arena, including layered background gradients,
  dual-density vector grids, glowing layout outlines, and a polished title
  screen and HUD treatment.
- Added cached CRT scanline and vignette overlays plus restrained chromatic UI
  highlighting while preserving the gameplay frame budget.

### Changed

- Refreshed arena, HUD, title, particle, projectile, enemy, power-up, and boss
  presentation to use the shared theme palette consistently.

### Fixed

- The status panel and `PRESS R TO RESTART` prompt now appear only after a
  victory or defeat instead of remaining visible during normal play.
- Telemetry now records `player_death` only when a player-hit event is lethal,
  instead of treating every damage event as a death.

### Verification

- `bun run verify`: lint, typecheck, 122 tests, deterministic replay, soak,
  restart latency, and production build all passing.

## [0.5.0] - 2026-11-14

### Added

- Arena power-up pickups, including a guaranteed first-kill Missile drop and
  deterministic drops every fourth kill for Speed, Shields, Blaster, Surge, and
  Repair. Pickups level the matching fixed axis for free or restore health,
  magnetize toward the player, and expire after a short lifetime.
- Distinct diamond rendering for power-ups and a triangular missile projectile
  presentation.
- A five-second WARDEN INCOMING boss announcement with arena-space warning
  rings, a HUD countdown, and a progress bar. The boss now spawns only after the
  warning timer expires.
- A 4.5-second inter-wave breathing break with a `WAVE CLEAR · NEXT IN` HUD
  countdown and progress bar. The next wave now waits for the break to expire
  instead of starting as soon as the arena is clear.
- Higher Missiles axis levels now fire additional auto-targeting missiles per
  volley. Each level adds one missile, spreads the volley deterministically
  across nearby targets, and preserves the existing damage-per-missile value.
- Procedural music now varies by wave and boss encounter: wave numbers rotate
  bass progressions and add higher arpeggio layers, while boss music uses a
  separate driving bass cycle and lead phrasing.
- Comprehensive event-driven sound and visual effects: dedicated missile volley,
  power-up, wave transition, and boss-warning sounds; pooled particle bursts
  for combat, pickups, Surge, bosses, and arena mutations; plus camera trauma,
  damage/power-up flashes, and a low-health vignette.

### Changed

- Power-ups and XP pickups now share the same deterministic arena relocation
  and collection safety rules.
- Boss arrival is delayed by a configurable warning interval (`5000ms` by
  default), and the active warning blocks the normal wave-advance path.

### Verification

- `bun run verify`: lint, typecheck, 119 tests, deterministic replay, soak,
  restart latency, and production build all passing.

## [0.4.0] - 2026-11-14

### Added

- Fixed-axis progression with Speed, Shields, Missiles, Blaster, and Surge.
  XP banks directly into the selected axis and each level costs more XP, ordered
  from Speed (cheapest) to Surge (most expensive).
- Missiles axis with an auto-firing secondary projectile that targets the
  nearest active enemy or boss.
- Production Docker deployment with a multi-stage Bun/Nginx build,
  `docker-compose.yml`, health checks, and hardened static-file serving.
- Root-level `agent.md` workflow guide for future contributors and coding
  agents.

### Changed

- Enemy waves now spawn directly inside the active arena with a visible warning
  ring and a short delay before the enemies can move, attack, or deal contact
  damage.
- The card/deck progression system is shelved for now.
- Axis upgrades live in a compact bottom-of-screen bar and no longer pause the
  simulation. Controller `A` immediately levels the selected axis.

### Fixed

- Wave spawn points are now distributed across the arena instead of consuming
  adjacent candidate cells in a single corner.

### Verification

- `bun run verify`: lint, typecheck, 94 tests, deterministic replay, soak,
  restart latency, and production build all passing.

## [0.3.0] - 2026-11-14

### Added

- Title screen with game branding, control guidance, and start prompts before
  gameplay or simulation begins.
- Build metadata injection (version, Git commit, CI run number, build time) in
  the HUD and telemetry.
- Production build emits `dist/build-info.json`; CI publishes a build summary
  and uploads the versioned production artifact.

### Changed

- Controller aiming now fires automatically from the right stick; the right
  trigger and controller `A` are no longer fire inputs.
- Surge now dashes the player forward by its configured distance, grants a
  temporary invincible shield, and damages enemies along the dash path.

### Fixed

- Surge movement is resolved against arena boundaries so the dash cannot leave
  the safe play area.
- Title-screen integration now keeps the simulation paused until the player
  starts a run.

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
[0.3.0]: https://github.com/furyhawk/cinder/releases/tag/v0.3.0
[0.4.0]: https://github.com/furyhawk/cinder/releases/tag/v0.4.0
[0.5.0]: https://github.com/furyhawk/cinder/releases/tag/v0.5.0
[0.6.0]: https://github.com/furyhawk/cinder/releases/tag/v0.6.0
[0.7.0]: https://github.com/furyhawk/cinder/releases/tag/v0.7.0
