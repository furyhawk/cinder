import { describe, expect, it } from 'vitest';
import { foundryLayouts } from '../../src/sim/arena/layouts';
import { createMutationState, stepArenaMutation } from '../../src/sim/arena/mutate';
import { isMutationSafe, pointInPolygon } from '../../src/sim/arena/validate';
import { createInputFrame, createWorld } from '../../src/sim/world';
import type { ArenaLayout } from '../../src/sim/arena/geometry';

const cross = foundryLayouts.find((layout) => layout.id === 'foundry_cross')!;

describe('arena mutation trap safety', () => {
  it('relocates the player into the new polygon instead of stranding them', () => {
    const world = createWorld('arena-relocate', 'normal', {
      arenaIntervalMs: 1000,
      arenaTelegraphMs: 100,
    });

    // (300, 100) is inside foundry_ring but outside foundry_cross.
    world.state.player.x = 300;
    world.state.player.y = 100;
    world.state.arena.currentLayoutId = 'foundry_ring';
    world.state.arena.nextLayoutId = 'foundry_cross';
    world.state.arena.telegraphMsRemaining = 0;
    world.state.arena.timerMs = 1000;

    const events = world.step(createInputFrame(0));

    expect(world.state.arena.currentLayoutId).toBe('foundry_cross');
    expect(pointInPolygon([world.state.player.x, world.state.player.y], cross.polygon)).toBe(true);
    expect(world.state.player.invuln).toBeGreaterThan(0);
    expect(world.state.status).toBe('playing');
    expect(events.some((event) => event.type === 'arena_mutate' && event.data?.phase === 'relocated')).toBe(true);

    const startX = world.state.player.x;
    for (let tick = 1; tick <= 60; tick += 1) {
      world.step(createInputFrame(tick, { moveX: 1, moveY: 0 }));
    }
    expect(world.state.player.x).toBeGreaterThan(startX);
  });

  it('relocates enemies stranded outside the new polygon', () => {
    const world = createWorld('arena-enemy-relocate', 'normal', {
      arenaIntervalMs: 1000,
      arenaTelegraphMs: 100,
    });

    world.state.enemies.push({
      id: 1,
      kind: 'drone',
      x: 300,
      y: 100,
      vx: 0,
      vy: 0,
      radius: 12,
      hp: 18,
      maxHp: 18,
      speed: 120,
      contactDamage: 12,
      fireCooldown: 0,
      seed: 99,
    });

    world.state.arena.currentLayoutId = 'foundry_ring';
    world.state.arena.nextLayoutId = 'foundry_cross';
    world.state.arena.telegraphMsRemaining = 0;
    world.state.arena.timerMs = 1000;

    world.step(createInputFrame(0));

    const enemy = world.state.enemies[0];
    expect(pointInPolygon([enemy.x, enemy.y], cross.polygon)).toBe(true);
  });

  it('refuses to apply an unsafe layout', () => {
    const safe: ArenaLayout = {
      id: 'safe_room',
      polygon: [
        [80, 80],
        [1200, 80],
        [1200, 640],
        [80, 640],
      ],
    };
    const unsafe: ArenaLayout = {
      id: 'unsafe_pit',
      polygon: [
        [600, 340],
        [680, 340],
        [680, 400],
        [600, 400],
      ],
    };

    const world = createWorld('arena-unsafe', 'normal', {
      arenaIntervalMs: 1000,
      arenaTelegraphMs: 100,
      arenaMinRadius: 160,
      layouts: [safe, unsafe],
    });

    world.state.arena.nextLayoutId = 'unsafe_pit';
    world.state.arena.telegraphMsRemaining = 0;
    world.state.arena.timerMs = 1000;

    const events = world.step(createInputFrame(0));

    expect(world.state.arena.currentLayoutId).toBe('safe_room');
    expect(events.some((event) => event.type === 'arena_mutate' && event.data?.phase === 'mutated')).toBe(false);
    expect(events.some((event) => event.type === 'arena_mutate' && event.data?.phase === 'blocked')).toBe(true);
    expect(pointInPolygon([world.state.player.x, world.state.player.y], safe.polygon)).toBe(true);
  });

  it('does not emit a telegraph for an unsafe layout', () => {
    const safe: ArenaLayout = {
      id: 'safe_room',
      polygon: [
        [80, 80],
        [1200, 80],
        [1200, 640],
        [80, 640],
      ],
    };
    const unsafe: ArenaLayout = {
      id: 'unsafe_pit',
      polygon: [
        [600, 340],
        [680, 340],
        [680, 400],
        [600, 400],
      ],
    };

    const state = { ...createMutationState('safe_room'), timerMs: 900 };
    const result = stepArenaMutation(state, {
      dtMs: 200,
      intervalMs: 1000,
      telegraphMs: 100,
      bossPatternActive: false,
      layouts: [safe, unsafe],
      isLayoutSafe: (layout) => isMutationSafe(layout.polygon, 160),
    });

    expect(result.didTelegraph).toBe(false);
    expect(result.didBlock).toBe(true);
    expect(result.state.nextLayoutId).toBeNull();
  });

  it('never leaves the player outside the active polygon across an accelerated mutation soak', () => {
    const world = createWorld('arena-trap-soak', 'normal', {
      arenaIntervalMs: 300,
      arenaTelegraphMs: 100,
    });

    let mutations = 0;
    let telegraphs = 0;

    for (let tick = 0; tick < 3600; tick += 1) {
      world.state.player.hp = 1_000_000;
      const events = world.step(
        createInputFrame(tick, {
          moveX: Math.sin(tick / 17),
          moveY: Math.cos(tick / 23),
          aimX: Math.cos(tick / 11),
          aimY: Math.sin(tick / 13),
          fire: true,
          surge: tick % 120 === 0,
        }),
      );

      const active = foundryLayouts.find(
        (layout) => layout.id === world.state.arena.currentLayoutId,
      )!;
      expect(pointInPolygon([world.state.player.x, world.state.player.y], active.polygon)).toBe(true);

      mutations += events.filter(
        (event) => event.type === 'arena_mutate' && event.data?.phase === 'mutated',
      ).length;
      telegraphs += events.filter(
        (event) => event.type === 'arena_mutate' && event.data?.phase === 'telegraph',
      ).length;
    }

    expect(mutations).toBeGreaterThan(3);
    expect(telegraphs).toBeGreaterThan(0);
    expect(world.state.status).toBe('playing');
    expect(Number.isFinite(world.state.player.x)).toBe(true);
    expect(Number.isFinite(world.state.player.y)).toBe(true);
  });
});
