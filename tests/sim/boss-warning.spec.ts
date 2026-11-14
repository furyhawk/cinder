import { describe, expect, it } from 'vitest';
import {
  BOSS_WARNING_DURATION_MS,
  createInputFrame,
  createWorld,
} from '../../src/sim/world';

describe('boss arrival announcement', () => {
  it('uses a longer warning interval before spawning the boss', () => {
    expect(BOSS_WARNING_DURATION_MS).toBeGreaterThanOrEqual(5000);

    const world = createWorld('boss-warning-default', 'normal');
    world.state.wave = 5;
    world.state.waveTimer = 999999;

    const events = world.step(createInputFrame(0));

    expect(world.state.boss).toBeNull();
    expect(world.state.bossWarningMs).toBe(BOSS_WARNING_DURATION_MS);
    expect(world.state.bossWarningTotalMs).toBe(BOSS_WARNING_DURATION_MS);
    expect(events.some((event) => event.type === 'boss_warning' && event.data?.phase === 'warning')).toBe(true);
  });

  it('announces, counts down, then spawns exactly one boss', () => {
    const warningMs = 100;
    const world = createWorld('boss-warning-short', 'normal', { bossWarningMs: warningMs });
    world.state.wave = 5;
    world.state.waveTimer = 999999;

    const warningPhases: string[] = [];
    for (let tick = 0; tick < 30 && world.state.boss === null; tick += 1) {
      const events = world.step(createInputFrame(tick));
      for (const event of events) {
        if (event.type === 'boss_warning') {
          warningPhases.push(String(event.data?.phase));
        }
      }
      if (world.state.boss === null) {
        expect(world.state.bossWarningMs).toBeGreaterThanOrEqual(0);
      }
    }

    expect(warningPhases).toEqual(['warning', 'spawned']);
    expect(world.state.boss).not.toBeNull();
    expect(world.state.bossWarningMs).toBe(0);
    expect(world.state.boss!.generation).toBe(1);

    for (let tick = 30; tick < 60; tick += 1) {
      world.step(createInputFrame(tick));
    }
    expect(world.state.boss).not.toBeNull();
  });

  it('supports an explicit zero-duration override for accelerated tests', () => {
    const world = createWorld('boss-warning-zero', 'normal', { bossWarningMs: 0 });
    world.state.wave = 5;
    world.state.waveTimer = 999999;

    const events = world.step(createInputFrame(0));

    expect(world.state.boss).not.toBeNull();
    expect(events.some((event) => event.type === 'boss_warning' && event.data?.phase === 'spawned')).toBe(true);
  });

  it('keeps hard runs on the generation 2 announcement', () => {
    const world = createWorld('boss-warning-hard', 'hard', { bossWarningMs: 50 });
    world.state.wave = 5;
    world.state.waveTimer = 999999;

    let announcedGeneration = 0;
    for (let tick = 0; tick < 15 && world.state.boss === null; tick += 1) {
      const events = world.step(createInputFrame(tick));
      const announcement = events.find((event) => event.type === 'boss_warning');
      if (announcement) {
        announcedGeneration = Number(announcement.data?.generation ?? 0);
      }
    }

    expect(announcedGeneration).toBe(2);
    expect(world.state.boss?.generation).toBe(2);
  });
});
