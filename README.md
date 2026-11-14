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

Open **http://localhost:4173/** in a modern browser. The game starts immediately;
click the canvas if keyboard or mouse input does not appear to focus.

To build the production bundle:

```bash
bun run build
```

## Controls

| Action | Input |
| --- | --- |
| Move | `W`, `A`, `S`, `D` or arrow keys |
| Aim | Move the mouse |
| Fire | Hold the left mouse button |
| Surge | `Space` |
| Choose an upgrade | Click one of the three upgrade cards |
| Select Bulwark deck | `1` |
| Select Tempest deck | `2` |
| Toggle reduced motion | `M` |
| Toggle sound | `N` |
| Restart run | `R` |

### Controller

Standard-mapping gamepads are supported.

| Action | Input |
| --- | --- |
| Move | Left stick or D-pad |
| Aim | Right stick |
| Fire | Right trigger or `A` |
| Surge | `B` or right bumper |
| Choose an upgrade | D-pad left/right, then `A` |
| Restart run | `Start` |

## How to play

1. **Survive the waves.** Enemies spawn around the arena and attack with
   contact damage or projectiles. Clear a wave to trigger the next one.
2. **Collect green XP pickups.** Defeated enemies drop XP. At 24 XP you are
   offered three upgrades; click one to improve your run.
3. **Use Surge to escape and attack.** Surge dashes you forward with temporary
   invulnerability and damages nearby enemies. It has a cooldown, and killing
   enemies with it partially refunds that cooldown.
4. **Watch the arena.** Periodically the arena changes shape. An orange outline,
   expanding ring, and fill telegraph the incoming layout. Keep moving so you
   are not caught outside the new safe area.
5. **Build your run.** Cards are drawn from the selected deck as you progress.
   Bulwark focuses on durability, healing, and defensive pulses; Tempest focuses
   on speed, fire rate, boss damage, and chain/kill effects.
6. **Defeat the Warden.** After the early waves, the boss arrives. Damage routes
   to exposed weak-point modules while they are vulnerable. Destroy the modules
   to remove the boss's core armour, then finish the core.

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
- **Deck** — the active card deck.
- **Chain** — your current kill-chain multiplier and kill count. Taking damage
  or letting the chain timer expire resets it.
- **Cards** — number of deck cards acquired this run.
- **Wave** — current wave number.
- **Surge** — `Ready` or the remaining cooldown in milliseconds.
- **WARDEN GEN / WEAK POINT** — the boss generation and currently exposed
  module(s).

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
  to the 60 Hz simulation. It pauses while upgrade choices are open and adds a
  boss layer during the Warden fight.

## Development checks

```bash
bun run test       # unit, simulation, and feel tests
bun run verify     # lint, typecheck, tests, replay, soak, latency, build
bun run perf:frame # frame-budget smoke check
```

Simulation code lives in `src/sim/` and is deterministic and renderer-free.
Rendering, HUD, audio, telemetry, and tuning data are kept in their own
directories. Sound effects are synthesized at runtime with the Web Audio API,
so no external audio assets are required.
