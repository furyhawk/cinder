import { describe, expect, it } from 'vitest';
import { createInputFrame, createWorld, type EnemyState } from '../../src/sim/world';
import { foundryLayouts } from '../../src/sim/arena/layouts';
import { distanceToPolygonBoundary, pointInPolygon } from '../../src/sim/arena/validate';

function enemyAt(x: number, y: number, kind: EnemyState['kind'], speed: number): EnemyState {
  return {
    id: 1,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 14,
    hp: 100,
    maxHp: 100,
    speed,
    contactDamage: 0,
    fireCooldown: 999,
    seed: 1,
  };
}

describe('enemy arena entry', () => {
  it('moves off-screen wave spawns into the active arena', () => {
    const world = createWorld('enemy-entry', 'normal');
    const polygon = foundryLayouts[0].polygon;
    world.state.enemies.push(enemyAt(-80, 120, 'runner', 120));

    for (let tick = 0; tick < 180; tick += 1) {
      world.step(createInputFrame(tick));
    }

    const enemy = world.state.enemies[0];
    expect(enemy).toBeDefined();
    expect(pointInPolygon([enemy.x, enemy.y], polygon)).toBe(true);
    expect(distanceToPolygonBoundary([enemy.x, enemy.y], polygon)).toBeGreaterThan(enemy.radius);
  });

  it('also brings stationary archetypes inside before applying arena collision', () => {
    const world = createWorld('enemy-entry-turret', 'normal');
    const polygon = foundryLayouts[0].polygon;
    world.state.enemies.push(enemyAt(1360, 220, 'turret', 0));

    for (let tick = 0; tick < 180; tick += 1) {
      world.step(createInputFrame(tick));
    }

    const enemy = world.state.enemies[0];
    expect(enemy).toBeDefined();
    expect(pointInPolygon([enemy.x, enemy.y], polygon)).toBe(true);
    expect(distanceToPolygonBoundary([enemy.x, enemy.y], polygon)).toBeGreaterThan(enemy.radius);
  });
});
