import { describe, expect, it } from 'vitest';
import { createInputFrame, createWorld, type EnemyState } from '../../src/sim/world';

function targetAt(x: number, y: number): EnemyState {
  return {
    id: 9001,
    kind: 'turret',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 14,
    hp: 20,
    maxHp: 20,
    speed: 0,
    contactDamage: 0,
    fireCooldown: 999999,
    seed: 1,
  };
}

describe('player projectile range', () => {
  it('travels across the arena long enough to kill a distant enemy', () => {
    const world = createWorld('projectile-range', 'normal');
    world.state.enemies.push(targetAt(1000, 360));

    let enemyDied = false;
    for (let tick = 0; tick < 120; tick += 1) {
      const events = world.step(
        createInputFrame(tick, { aimX: 1, aimY: 0, fire: true }),
      );
      enemyDied ||= events.some((event) => event.type === 'enemy_died');
    }

    expect(enemyDied).toBe(true);
    expect(world.state.killCount).toBeGreaterThanOrEqual(1);
  });
});

describe('wave progression after early kills', () => {
  it('spawns the next wave after the first two enemies are killed', () => {
    const world = createWorld('wave-progression', 'normal', { waveBreakMs: 120 });
    world.state.player.hp = 1_000_000;
    world.state.player.maxHp = 1_000_000;

    for (let tick = 0; tick < 300; tick += 1) {
      const target = world.state.enemies[0];
      const aimX = target ? target.x - world.state.player.x : 1;
      const aimY = target ? target.y - world.state.player.y : 0;
      world.step(createInputFrame(tick, { aimX, aimY, fire: true }));
    }

    expect(world.state.killCount).toBeGreaterThanOrEqual(2);
    expect(world.state.wave).toBeGreaterThanOrEqual(3);
    expect(world.state.enemies.length).toBeGreaterThan(0);
  });
});
