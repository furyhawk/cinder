import { describe, expect, it } from 'vitest';
import {
  createInputFrame,
  createWorld,
  MINI_WAVES_PER_WAVE,
  splitWaveThreatBudget,
} from '../../src/sim/world';
import { planWaveSpawns } from '../../src/sim/systems/director';

describe('mini-wave pacing', () => {
  it('splits a wave threat budget deterministically without losing threat', () => {
    const shares = splitWaveThreatBudget(34, MINI_WAVES_PER_WAVE);
    expect(shares).toHaveLength(MINI_WAVES_PER_WAVE);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(34);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });

  it('keeps each mini-wave as a group instead of one expensive enemy', () => {
    const plan = planWaveSpawns(
      2,
      [
        { x: 120, y: 120 },
        { x: 1160, y: 120 },
        { x: 640, y: 640 },
      ],
      { x: 640, y: 360 },
      2,
    );

    expect(plan).toHaveLength(2);
    expect(plan.reduce((sum, entry) => sum + entry.threat, 0)).toBe(2);
  });

  it('spawns successive mini-waves before clearing the main wave', () => {
    const world = createWorld('mini-wave-pacing', 'normal', {
      waveBreakMs: 120,
      miniWaveBreakMs: 100,
    });
    world.state.player.hp = 1_000_000;
    world.state.player.maxHp = 1_000_000;

    for (let tick = 0; tick < 90 && world.state.enemies.length === 0; tick += 1) {
      world.step(createInputFrame(tick));
    }

    expect(world.state.enemies.length).toBeGreaterThanOrEqual(2);
    expect(world.state.activeWave).toBe(1);
    expect(world.state.miniWave).toBe(1);
    expect(world.state.miniWaveTotal).toBe(MINI_WAVES_PER_WAVE);
    expect(world.state.miniWaveBudgets).toHaveLength(MINI_WAVES_PER_WAVE - 1);

    for (let group = 1; group < MINI_WAVES_PER_WAVE; group += 1) {
      world.state.enemies.length = 0;
      const clearEvents = world.step(createInputFrame(200 + group));
      expect(world.state.miniWaveBreakMs).not.toBeNull();
      expect(world.state.waveBreakMs).toBeNull();
      expect(
        clearEvents.some(
          (event) => event.type === 'wave_break' && event.data?.phase === 'started',
        ),
      ).toBe(false);

      let ticksUntilNextGroup = 0;
      while (
        world.state.enemies.length === 0 &&
        ticksUntilNextGroup < 30
      ) {
        world.step(createInputFrame(300 + group * 40 + ticksUntilNextGroup));
        ticksUntilNextGroup += 1;
      }

      expect(world.state.enemies.length).toBeGreaterThan(0);
      expect(world.state.miniWave).toBe(group + 1);
      expect(world.state.waveBreakMs).toBeNull();
    }

    world.state.enemies.length = 0;
    const finalEvents = world.step(createInputFrame(900));
    expect(world.state.waveBreakMs).not.toBeNull();
    expect(world.state.waveBreakTotalMs).toBe(120);
    expect(world.state.miniWaveBreakMs).toBeNull();
    expect(
      finalEvents.some(
        (event) => event.type === 'wave_break' && event.data?.phase === 'started',
      ),
    ).toBe(true);
  });
});
