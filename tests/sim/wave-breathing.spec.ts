import { describe, expect, it } from 'vitest';
import {
  createInputFrame,
  createWorld,
  WAVE_BREATHING_ROOM_MS,
  type EnemyState,
} from '../../src/sim/world';

const TICK_MS = 1000 / 60;

function targetAt(x: number, y: number): EnemyState {
  return {
    id: 7001,
    kind: 'runner',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 12,
    hp: 1,
    maxHp: 1,
    speed: 0,
    contactDamage: 0,
    fireCooldown: 9999,
    seed: 1,
  };
}

describe('inter-wave breathing room', () => {
  it('defaults to a multi-second intermission', () => {
    expect(WAVE_BREATHING_ROOM_MS).toBeGreaterThanOrEqual(4000);
  });

  it('holds the next wave until the break timer expires', () => {
    const breakMs = 250;
    const world = createWorld('wave-breathing', 'normal', { waveBreakMs: breakMs });
    world.state.player.hp = 1_000_000;
    world.state.player.maxHp = 1_000_000;
    world.state.wave = 2;
    world.state.waveTimer = 999999;
    world.state.enemies.push(targetAt(world.state.player.x + 120, world.state.player.y));

    let clearEvents: ReturnType<typeof world.step> = [];
    for (let tick = 0; tick < 30 && world.state.enemies.length > 0; tick += 1) {
      clearEvents = world.step(createInputFrame(tick, { aimX: 1, aimY: 0, fire: true }));
    }

    expect(world.state.enemies).toHaveLength(0);
    expect(world.state.waveBreakMs).not.toBeNull();
    expect(world.state.waveBreakTotalMs).toBe(breakMs);
    expect(
      clearEvents.some(
        (event) => event.type === 'wave_break' && event.data?.phase === 'started',
      ),
    ).toBe(true);

    let ticksUntilNextWave = 0;
    while (world.state.enemies.length === 0 && ticksUntilNextWave < 60) {
      world.step(createInputFrame(100 + ticksUntilNextWave));
      ticksUntilNextWave += 1;
    }

    const minimumTicks = Math.floor(breakMs / TICK_MS) - 1;
    expect(ticksUntilNextWave).toBeGreaterThanOrEqual(minimumTicks);
    expect(world.state.wave).toBe(3);
    expect(world.state.enemies.length).toBeGreaterThan(0);
    expect(world.state.waveBreakMs).toBeNull();
  });
});
