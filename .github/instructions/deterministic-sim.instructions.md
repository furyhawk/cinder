---
description: Deterministic simulation and fixed-step input handling rules for gameplay code.
applyTo: "src/**/*.ts"
---

# Deterministic simulation learnings

## Learnings

- In this project, `world.step()` must run **only** inside the fixed-step game loop, never directly from DOM/input handlers. Queue intents (for example surge/restart/select) and consume them on the next simulation tick; direct out-of-band stepping caused state divergence and runtime crashes.
- When iterating mutable entity arrays (`projectiles`, `enemies`, `pickups`), treat entries as potentially stale after splices and adjust indices (`index -= 1`) immediately after removals. Avoiding this pattern previously led to `undefined` entity access errors during collision/update passes.
- Determinism/perf changes are complete only when they are wired into machine gates (`bun run verify`, replay hash checks, soak/perf scripts), not just manual play checks.
