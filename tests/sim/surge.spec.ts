import { describe, expect, it } from 'vitest';
import { createInputFrame, createWorld } from '../../src/sim/world';

describe('surge invariants', () => {
  it('grants i-frames for full surge duration and expires after', () => {
    const world = createWorld('surge-iframe', 'normal');
    const initialHp = world.state.player.hp;

    world.step(createInputFrame(0, { surge: true }));

    for (let tick = 1; tick <= 8; tick += 1) {
      world.state.projectiles.push({
        x: world.state.player.x,
        y: world.state.player.y,
        vx: 0,
        vy: 0,
        radius: 5,
        damage: 10,
        life: 20,
        owner: 'enemy',
      });
      world.step(createInputFrame(tick));
      expect(world.state.player.hp).toBe(initialHp);
    }

    world.state.projectiles.push({
      x: world.state.player.x,
      y: world.state.player.y,
      vx: 0,
      vy: 0,
      radius: 5,
      damage: 10,
      life: 20,
      owner: 'enemy',
    });
    world.step(createInputFrame(9));
    expect(world.state.player.hp).toBeLessThan(initialHp);
  });

  it('dashes forward by surgeDistance and explodes along the path', () => {
    const world = createWorld('surge-dash', 'normal');
    const player = world.state.player;
    const startX = player.x;
    const startY = player.y;
    const enemyAtStart = {
      id: 1,
      kind: 'drone' as const,
      x: startX + 5,
      y: startY,
      vx: 0,
      vy: 0,
      radius: 10,
      hp: 100,
      maxHp: 100,
      speed: 0,
      contactDamage: 0,
      fireCooldown: 9999,
      seed: 1,
    };
    const enemyAtDestination = {
      ...enemyAtStart,
      id: 2,
      x: startX + player.surgeDistance - 5,
    };
    world.state.enemies.push(enemyAtStart, enemyAtDestination);

    world.step(createInputFrame(0, { surge: true, aimX: 1, aimY: 0 }));

    expect(player.x).toBeCloseTo(startX + player.surgeDistance, 5);
    expect(player.y).toBeCloseTo(startY, 5);
    expect(player.invuln).toBeGreaterThanOrEqual(140);
    expect(world.state.enemies.find((enemy) => enemy.id === 1)?.hp).toBeLessThan(100);
    expect(world.state.enemies.find((enemy) => enemy.id === 2)?.hp).toBeLessThan(100);
  });

  it('refunds surge cooldown by 40% on surge kill', () => {
    const world = createWorld('surge-refund', 'normal');
    world.state.enemies.push({
      id: 1,
      kind: 'drone',
      x: world.state.player.x + 5,
      y: world.state.player.y + 5,
      vx: 0,
      vy: 0,
      radius: 10,
      hp: 1,
      maxHp: 1,
      speed: 0,
      contactDamage: 0,
      fireCooldown: 9999,
      seed: 1,
    });

    world.step(createInputFrame(0, { surge: true }));
    expect(world.state.player.surgeCooldown).toBeCloseTo(252, 5);
  });
});
