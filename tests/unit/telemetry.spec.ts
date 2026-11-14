import { describe, expect, it } from 'vitest';
import { TelemetrySession } from '../../src/telemetry';
import type { SimEvent, WorldState } from '../../src/sim/world';

function worldFixture(): WorldState {
  return {
    tick: 0,
    seed: 'seed',
    difficulty: 'normal',
    status: 'playing',
    wave: 1,
    waveTimer: 0,
    boss: null,
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 7,
      hp: 100,
      maxHp: 100,
      moveSpeed: 220,
      fireCooldown: 0,
      shotRate: 8.5,
      projectileSpeed: 900,
      projectileDamage: 24,
      aimX: 1,
      aimY: 0,
      invuln: 0,
      surgeCooldown: 0,
      surgeTimer: 0,
      surgeDamage: 24,
      surgeDistance: 110,
      shield: 0,
      deck: 'bulwark',
      fireBufferMs: 0,
      surgeBufferMs: 0,
    },
    enemies: [],
    projectiles: [],
    pickups: [],
    xp: 0,
    pendingUpgrades: [],
    killCount: 0,
    score: 0,
    rng: 0,
  };
}

describe('telemetry session', () => {
  it('serializes NDJSON records for run lifecycle and sim events', () => {
    const telemetry = new TelemetrySession('run-test', 'build-test');
    const world = worldFixture();
    telemetry.emitRunStart(world);

    const events: SimEvent[] = [
      { type: 'card_offered', tick: 1 },
      { type: 'player_hit', tick: 2, data: { source: 'contact', hp: 12 } },
    ];
    telemetry.emitSimEvents(world, events);
    telemetry.emitRunEnd(world, 'defeat');

    const lines = telemetry.exportNdjson().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.some((line) => line.includes('"event":"run_start"'))).toBe(true);
    expect(lines.some((line) => line.includes('"event":"player_death"'))).toBe(true);
    expect(lines.some((line) => line.includes('"event":"run_end"'))).toBe(true);
  });
});
