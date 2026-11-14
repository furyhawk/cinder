import { describe, expect, it } from 'vitest';
import {
  createInputFrame,
  createWorld,
  missileVolleySize,
  type EnemyState,
} from '../../src/sim/world';

function targetAt(id: number, x: number, y: number): EnemyState {
  return {
    id,
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

function missileProjectiles(world: ReturnType<typeof createWorld>) {
  return world.state.projectiles.filter(
    (projectile) => projectile.owner === 'player' && projectile.kind === 'missile',
  );
}

describe('missile volley scaling', () => {
  it('maps each Missiles level to one projectile in the volley', () => {
    expect(missileVolleySize(0)).toBe(0);
    expect(missileVolleySize(1)).toBe(1);
    expect(missileVolleySize(2)).toBe(2);
    expect(missileVolleySize(4)).toBe(4);
  });

  it('fires two missiles at level 2 and three at level 3', () => {
    const world = createWorld('missile-volley-levels', 'normal');
    world.state.xp = 1000;
    world.applyUpgrade('missiles');
    world.applyUpgrade('missiles');
    world.state.enemies.push(targetAt(1, world.state.player.x + 120, world.state.player.y));

    const events = world.step(createInputFrame(0));
    expect(missileProjectiles(world)).toHaveLength(2);
    expect(events.some((event) => event.type === 'missile_fire' && Number(event.data?.count) === 2)).toBe(true);

    world.state.projectiles.splice(0);
    world.applyUpgrade('missiles');
    world.state.player.missileCooldown = 0;
    world.step(createInputFrame(1));
    expect(missileProjectiles(world)).toHaveLength(3);
  });

  it('spreads a higher-level volley across multiple targets', () => {
    const world = createWorld('missile-volley-targets', 'normal');
    world.state.xp = 1000;
    world.applyUpgrade('missiles');
    world.applyUpgrade('missiles');
    const { x, y } = world.state.player;
    world.state.enemies.push(targetAt(1, x + 120, y));
    world.state.enemies.push(targetAt(2, x, y + 120));

    world.step(createInputFrame(0));

    const missiles = missileProjectiles(world);
    expect(missiles).toHaveLength(2);
    expect(missiles[0].vx).not.toBeCloseTo(missiles[1].vx);
    expect(missiles[0].vy).not.toBeCloseTo(missiles[1].vy);
  });

  it('uses the new count after collecting a second missile power-up', () => {
    const world = createWorld('missile-volley-powerup', 'normal');
    world.state.xp = 1000;
    world.applyUpgrade('missiles');
    world.spawnPowerUp('missile', world.state.player.x, world.state.player.y);
    world.step(createInputFrame(0));
    world.state.projectiles.splice(0);
    world.state.enemies.push(targetAt(1, world.state.player.x + 120, world.state.player.y));

    world.step(createInputFrame(1));

    expect(world.state.axisLevels.missiles).toBe(2);
    expect(missileProjectiles(world)).toHaveLength(2);
  });
});
