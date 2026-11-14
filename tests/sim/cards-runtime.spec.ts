import { describe, expect, it } from 'vitest';
import { createInputFrame, createWorld, type EnemyState } from '../../src/sim/world';

describe('card runtime hooks', () => {
  it('draws and applies a deck card when progression is offered', () => {
    const world = createWorld('cards-seed', 'normal');
    world.setDeck('tempest');
    world.state.xp = 24;

    world.step(createInputFrame(0, { aimX: 1, aimY: 0 }));

    expect(world.state.cardsOwned).toContain('tempest_velocity');
    expect(world.state.cardEffects.moveSpeedMul).toBeCloseTo(0.04);
  });

  it('revives once when revive hook is active', () => {
    const world = createWorld('revive-seed', 'normal');
    world.state.cardEffects.reviveHp = 30;
    world.state.player.hp = 10;
    world.state.player.invuln = 0;
    world.state.enemies.push({
      id: 999,
      kind: 'runner',
      x: world.state.player.x,
      y: world.state.player.y,
      vx: 0,
      vy: 0,
      radius: 12,
      hp: 20,
      maxHp: 20,
      speed: 0,
      contactDamage: 20,
      fireCooldown: 0,
      seed: 1,
    } satisfies EnemyState);

    world.step(createInputFrame(0));

    expect(world.state.reviveUsed).toBe(true);
    expect(world.state.player.hp).toBe(30);
    expect(world.state.status).toBe('playing');
  });
});
