## 1. Operating contract — read this first

This document is written to be executed, not interpreted. Three rules govern how you use it.

**Rule 1 — The plan is ordered, not suggestive.** Workstreams are numbered `W0`–`W9`. Do not begin a workstream until every item in its *Depends on* row is at status `done` in `status.json`. If you believe an ordering is wrong, record the objection in your handoff and proceed with the specified order.

**Rule 2 — Ambiguity resolves downward to the listed default.** Every place where a reasonable engineer could choose differently, a default is given in a table. Use the default. Do not stop to ask unless the default is *impossible* in the current environment (e.g. a required binary is missing), in which case follow §11.3.

**Rule 3 — Every workstream ends with a gate that a machine can check.** Gates are shell commands with expected exit codes (§9). "It looks right" is not a gate. A workstream without a passing gate is not done, regardless of how complete the code appears.

### 1.1 What you are building, in one paragraph

A playable browser-based vertical slice of an arcade twin-stick shooter. One arena biome, one boss with two difficulty generations, eight enemy archetypes, a 12-node upgrade tree, two card decks, three difficulty tiers, full input-driven deterministic simulation, and telemetry. The loop: survive escalating waves in a shape-shifting arena, bank experience into upgrades mid-run, open card decks for build variance, kill the boss, restart in under 1.5 seconds. Target session length 12–18 minutes.

### 1.2 Non-goals for v1.0

Do not build: multiplayer, netcode, save-game cloud sync, more than one biome, more than one boss, localisation, controller remapping UI, achievements, store integration, or a level editor. Each is deliberately deferred past the slice gate (§8, M5). If you find yourself building one, you have misread the scope.
