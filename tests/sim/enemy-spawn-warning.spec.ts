import { describe, expect, it } from 'vitest';
import {
  createInputFrame,
  createWorld,
  ENEMY_SPAWN_WARNING_MS,
  type EnemyState,
} from '../../src/sim/world';
import { foundryLayouts } from '../../src/sim/arena/layouts';
import { isPositionSafe } from '../../src/sim/arena/validate';

function warningEnemy(x: number, y: number): EnemyState {
  return {
    id: 9001,
    kind: 'runner',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 14,
    hp: 100,
    maxHp: 100,
    speed: 120,
    contactDamage: 20,
    fireCooldown: 999,
    seed: 1,
    spawnWarningMs: ENEMY_SPAWN_WARNING_MS,
  };
}

describe('enemy spawn warnings', () => {
  it('spawns wave enemies directly inside the active arena', () => {
    const world = createWorld('enemy-spawn-inside', 'normal');
    for (let tick = 0; tick < 70; tick += 1) {
      world.step(createInputFrame(tick));
    }

    const polygon = foundryLayouts[0].polygon;
    expect(world.state.enemies.length).toBeGreaterThan(0);
    for (const enemy of world.state.enemies) {
      expect(isPositionSafe([enemy.x, enemy.y], polygon, enemy.radius)).toBe(true);
      expect(enemy.spawnWarningMs).toBeGreaterThan(0);
    }
  });

  it('spreads a wave across the arena instead of spawning in one corner', () => {
    const world = createWorld('enemy-spawn-spread', 'normal');
    for (let tick = 0; tick < 70; tick += 1) {
      world.step(createInputFrame(tick));
    }

    const enemies = world.state.enemies;
    expect(enemies.length).toBeGreaterThan(1);
    const xs = enemies.map((enemy) => enemy.x);
    const ys = enemies.map((enemy) => enemy.y);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    expect(spreadX > 300 || spreadY > 300).toBe(true);
  });

  it('holds enemies still and non-damaging until the warning expires', () => {
    const world = createWorld('enemy-spawn-warning', 'normal');
    const player = world.state.player;
    const enemy = warningEnemy(player.x, player.y);
    world.state.enemies.push(enemy);
    const initialHp = player.hp;

    world.step(createInputFrame(0));

    expect(player.hp).toBe(initialHp);
    expect(enemy.x).toBe(player.x);
    expect(enemy.y).toBe(player.y);
    expect(enemy.spawnWarningMs).toBeLessThan(ENEMY_SPAWN_WARNING_MS);

    for (let tick = 1; tick < 40; tick += 1) {
      world.step(createInputFrame(tick));
    }

    expect(enemy.spawnWarningMs).toBe(0);
    expect(player.hp).toBeLessThan(initialHp);
  });
});
