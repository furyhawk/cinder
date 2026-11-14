import { describe, expect, it } from 'vitest';
import { createInputFrame, createWorld } from '../../src/sim/world';

describe('boss runtime behaviour', () => {
  it('emits boss_phase event on phase transition', () => {
    const world = createWorld('boss-phase-event', 'normal', { bossWarningMs: 50 });
    world.state.wave = 5;
    world.state.waveTimer = 999999;
    for (let tick = 0; tick < 10 && world.state.boss === null; tick += 1) {
      world.step(createInputFrame(tick));
    }
    const boss = world.state.boss;
    if (!boss) throw new Error('Expected boss to spawn');
    boss.hp = boss.maxHp * 0.6;
    boss.phase = 1;

    const events = world.step(createInputFrame(1));
    const sawPhaseEvent = events.some((event) => event.type === 'boss_phase' && Number(event.data?.phase) === 2);

    expect(sawPhaseEvent).toBe(true);
  });
});
