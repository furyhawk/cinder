import { describe, expect, it } from 'vitest';
import {
  createInputFrame,
  createWorld,
  UPGRADE_AXES,
  upgradeAxisCost,
  type EnemyState,
} from '../../src/sim/world';

function targetAt(x: number, y: number): EnemyState {
  return {
    id: 9001,
    kind: 'runner',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 12,
    hp: 100,
    maxHp: 100,
    speed: 0,
    contactDamage: 0,
    fireCooldown: 9999,
    seed: 1,
  };
}

describe('fixed-axis progression', () => {
  it('levels an axis immediately without pausing or creating an offer', () => {
    const world = createWorld('axis-immediate', 'normal');
    world.state.xp = upgradeAxisCost('speed', 0);
    const initialTick = world.state.tick;

    world.applyUpgrade('speed');
    world.step(createInputFrame(0));

    expect(world.state.axisLevels.speed).toBe(1);
    expect(world.state.xp).toBe(0);
    expect(world.state.pendingUpgrades).toHaveLength(0);
    expect(world.state.tick).toBe(initialTick + 1);
  });

  it('orders base costs from Speed lowest to Surge highest', () => {
    const costs = UPGRADE_AXES.map((axis) => upgradeAxisCost(axis, 0));

    expect(costs).toEqual([6, 7, 8, 9, 10]);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
  });

  it('raises each axis cost as its level increases', () => {
    for (const axis of UPGRADE_AXES) {
      expect(upgradeAxisCost(axis, 1)).toBeGreaterThan(upgradeAxisCost(axis, 0));
      expect(upgradeAxisCost(axis, 2)).toBeGreaterThan(upgradeAxisCost(axis, 1));
    }
  });

  it('banks XP into whichever axes the player chooses', () => {
    const world = createWorld('axis-bank', 'normal');
    world.state.xp = 1000;
    const initialShotRate = world.state.player.shotRate;
    const initialSurgeDamage = world.state.player.surgeDamage;

    for (const axis of UPGRADE_AXES) {
      world.applyUpgrade(axis);
    }

    for (const axis of UPGRADE_AXES) {
      expect(world.state.axisLevels[axis]).toBe(1);
    }
    expect(world.state.player.moveSpeed).toBe(240);
    expect(world.state.player.maxHp).toBe(125);
    expect(world.state.player.missileDamage).toBe(10);
    expect(world.state.player.shotRate).toBeCloseTo(initialShotRate + 1.25);
    expect(world.state.player.surgeDamage).toBe(initialSurgeDamage + 12);
  });

  it('does not level an axis without enough XP', () => {
    const world = createWorld('axis-cost', 'normal');
    world.state.xp = upgradeAxisCost('speed', 0) - 1;

    world.applyUpgrade('speed');

    expect(world.state.axisLevels.speed).toBe(0);
    expect(world.state.player.moveSpeed).toBe(220);
  });

  it('makes the missiles axis fire a missile at the nearest active enemy', () => {
    const world = createWorld('axis-missiles', 'normal');
    world.state.xp = upgradeAxisCost('missiles', 0);
    world.applyUpgrade('missiles');
    world.state.enemies.push(targetAt(world.state.player.x + 120, world.state.player.y));

    world.step(createInputFrame(0));

    expect(world.state.projectiles.some((projectile) => projectile.owner === 'player' && projectile.damage === 10)).toBe(true);
  });

  it('collects XP token pickups toward the next axis level', () => {
    const world = createWorld('axis-pickup', 'normal');
    world.state.pickups.push({
      id: 1,
      x: world.state.player.x,
      y: world.state.player.y,
      value: 4,
      radius: 7,
      lifeMs: 12000,
    });

    world.step(createInputFrame(0));

    expect(world.state.xp).toBe(4);
  });
});
