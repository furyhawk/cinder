# Cinder

A browser-based twin-stick shooter vertical slice set in the Foundry. Move, aim,
fire, and Surge through escalating enemy waves in a shape-shifting arena, then
defeat the Warden boss.

## Quick start

Requirements: [Bun](https://bun.sh/) 1.4+.

```bash
bun install
bun run dev
```

Open **http://localhost:4173/** in a modern browser. The title screen appears
first; press `Enter`, click, or press controller `A`/`Start` to begin. Click the
canvas if keyboard or mouse input does not appear to focus.

To build the production bundle:

```bash
bun run build
```

### Docker deployment

Build and run the production bundle behind Nginx:

```bash
docker compose up --build -d
```

The game is then available at **http://localhost:8787/**. Override the host port
with `CINDER_PORT`, for example `CINDER_PORT=9000 docker compose up --build -d`.
Stop the deployment with `docker compose down`.

### Docker Hub CI/CD

The `CI` GitHub Actions workflow verifies every pull request and push. After a
successful verification on `main` or a `v*` tag, it builds and publishes the
production image to Docker Hub as:

```text
docker.io/<DOCKERHUB_USERNAME>/cinder
```

Published tags include the branch name on `main`, `latest` on the default
branch, the commit SHA (`sha-*`), and semantic version tags such as `0.6.0` and
`0.6` for version tags.

Configure these GitHub Actions repository secrets before publishing:

- `DOCKERHUB_USERNAME` — Docker Hub account or organization name.
- `DOCKERHUB_TOKEN` — Docker Hub access token with read/write permission.

Publishing can also be started manually from **Actions → CI → Run workflow**.
Pull requests run verification but never log in to or push to Docker Hub.

## Controls

| Action | Input |
| --- | --- |
| Move | `W`, `A`, `S`, `D` or arrow keys |
| Aim | Move the mouse |
| Fire | Hold the left mouse button |
| Surge | `Space` |
| Select axis | `Q` / `E` or D-pad left/right |
| Level selected axis | Controller `A`, `Enter`, `1`-`5`, or click an axis |
| Toggle reduced motion | `M` |
| Toggle sound | `N` |
| Restart run | `R` |

### Controller

Standard-mapping gamepads are supported.

| Action | Input |
| --- | --- |
| Move | Left stick or D-pad |
| Aim / Fire | Right stick (fires automatically while aiming) |
| Surge | `B` or right bumper |
| Select axis | D-pad left/right |
| Level selected axis | `A` |
| Restart run | `Start` |

## How to play

Press `Enter`, click, or press controller `A`/`Start` on the title screen to begin.

1. **Survive the waves.** Enemies spawn at warned points inside the arena.
   A pulsing ring and `!` marker show each spawn point before the enemy becomes
   active; use the warning time to move clear. Clearing a wave starts a
   4.5-second breathing break with a countdown before the next wave arrives.
2. **Collect green XP pickups.** Defeated enemies drop XP tokens. Use them at
   any time to level one of five fixed axes: Speed, Shields, Missiles, Blaster,
   or Surge. Selecting an axis and pressing controller `A` levels it
   immediately without pausing the fight. Costs rise with each level; Speed is
   cheapest and Surge is most expensive.
3. **Grab diamond power-ups.** The first enemy you kill drops a missile pickup,
   and every fourth kill drops another random power-up. Power-ups immediately
   level their matching axis (or repair health) at no XP cost. Colored diamonds
   are drawn in the arena and drift toward you when nearby.
4. **Use Surge to escape and attack.** Surge dashes you forward with temporary
   invulnerability and damages nearby enemies. It has a cooldown, and killing
   enemies with it partially refunds that cooldown.
5. **Watch the arena.** Periodically the arena changes shape. An orange outline,
   expanding ring, and fill telegraph the incoming layout. Keep moving so you
   are not caught outside the new safe area.
6. **Build your run.** Bank XP and collect power-ups across the run. Speed
   improves movement, Shields add durability, Missiles add an extra
   auto-firing projectile per level, Blaster improves primary fire, and Surge
   improves your dash and explosion.
7. **Defeat the Warden.** After the early waves, a five-second **WARDEN
   INCOMING** announcement marks the boss arrival point before the Warden
   spawns. Damage routes to exposed weak-point modules while they are
   vulnerable. Destroy the modules to remove the boss's core armour, then
   finish the core.

## Enemy roster

- **Drone** — basic chaser.
- **Runner** — fast, fragile chaser.
- **Orbiter** — circles the player at range.
- **Charger** — accelerates into close-range contact attacks.
- **Turret** — stationary single-shot ranged enemy.
- **Spinner** — drifting ring-burst enemy.
- **Splitter** — splits into drones when destroyed.
- **Lancer** — fast, precise ranged enemy.
- **Weaver** — fast zig-zagging melee enemy that is hard to track.
- **Bomber** — armoured enemy that fires a radial eight-shot burst when close.

## HUD guide

- **HP** — your current and maximum health.
- **XP** — progress toward the next upgrade offer.
- **Axes** — your current Speed, Shields, Missiles, Blaster, and Surge levels.
- **Chain** — your current kill-chain multiplier and kill count. Taking damage
  or letting the chain timer expire resets it.
- **Wave** — current wave number.
- **WAVE CLEAR** — a countdown and progress bar showing the remaining
  breathing room before the next wave.
- **Surge** — `Ready` or the remaining cooldown in milliseconds.
- **WARDEN INCOMING** — a pulsing arena marker, countdown, and progress bar
  shown before the boss spawns.
- **WARDEN GEN / WEAK POINT** — the boss generation and currently exposed
  module(s).

## Audio and effects

- Combat events have dedicated synthesized sounds: primary fire, missile
  volleys, enemy hits and deaths, player damage, Surge, XP and power-up pickups,
  wave clears/starts, boss warnings, phase changes, module breaks, arena
  mutations, upgrades, victory, and defeat.
- Event-driven particle bursts highlight impacts, deaths, pickups, missile
  launches, Surge dashes, boss damage, and arena mutations. The effect pool is
  capped at 1,800 particles.
- Screen feedback includes camera shake for impactful hits, brief damage and
  power-up color flashes, and a pulsing low-health vignette.

## Difficulty and boss generations

The simulation supports easy, normal, and hard difficulty tiers. Hard runs use
the Generation 2 Warden with a larger health pool and denser attack patterns.
Difficulty and boss data are authored in `src/data/`.

## Troubleshooting

- **Blank page:** make sure you are opening the URL printed by Vite, normally
  `http://localhost:4173/`, and hard-refresh the page.
- **Testing from another device:** use the Network URL printed by Vite. The game
  no longer depends on `crypto.randomUUID`, so plain-HTTP LAN origins work.
- **Canvas is larger than the window:** the game canvas is fixed at 1280x720;
  zoom out or use a larger window to see the whole arena.
- **Input does not respond:** click the canvas once, then use the keyboard and
  mouse again.
- **No sound:** press `N` to check whether sound is muted. Browsers require a
  click or key press before audio can start; the first input unlocks sound.
- **Music:** the procedural soundtrack runs at 120 BPM on a grid synchronized
  to the 60 Hz simulation. Wave arrangements add higher arpeggios and rhythmic
  variation as the run progresses, while the Warden fight switches to a
  distinct driving bass progression and lead phrase. It pauses when the
  simulation is paused.

## Development checks

```bash
bun run test       # unit, simulation, and feel tests
bun run verify     # lint, typecheck, tests, replay, soak, latency, build
bun run perf:frame # frame-budget smoke check
```

Agent and contributor workflow details are in [`agent.md`](agent.md).

Simulation code lives in `src/sim/` and is deterministic and renderer-free.
Rendering, HUD, audio, telemetry, and tuning data are kept in their own
directories. Sound effects are synthesized at runtime with the Web Audio API,
so no external audio assets are required.

The HUD shows the release version, Git commit, and CI build number. Production
builds also emit `dist/build-info.json`, and CI uploads the full `dist/`
directory as a versioned artifact.
