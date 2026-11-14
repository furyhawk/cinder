import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInputFrame,
  createWorld,
  type EnemyState,
} from '../../src/sim/world';
import {
  POWER_UP_DEFINITIONS,
  POWER_UP_TYPES,
  powerUpDropForKill,
} from '../../src/sim/powerups';

function targetAt(x: number, y: number): EnemyState {
  return {
    id: 9001,
    kind: 'runner',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 12,
    hp: 1,
    maxHp: 1,
    speed: 0,
    contactDamage: 0,
    fireCooldown: 9999,
    seed: 1,
  };
}

describe('power-up content contract', () => {
  it('defines missiles and the rest of the pickup suite', () => {
    const path = join(process.cwd(), 'src', 'data', 'powerups.json');
    const data = JSON.parse(readFileSync(path, 'utf8')) as Array<{
      type: string;
      label: string;
      description: string;
    }>;

    expect(data.map((entry) => entry.type)).toEqual([...POWER_UP_TYPES]);
    expect(data[0]?.type).toBe('missile');
    for (const entry of data) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeLessThanOrEqual(60);
    }
  });

  it('guarantees the first drop is a missile and keeps later drops deterministic', () => {
    expect(powerUpDropForKill('drop-seed', 10, 1)).toBe('missile');
    const first = powerUpDropForKill('drop-seed', 40, 4);
    const second = powerUpDropForKill('drop-seed', 40, 4);
    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(powerUpDropForKill('drop-seed', 12, 3)).toBeNull();
  });
});

describe('power-up pickups', () => {
  it('collects a missile power-up and levels the missiles axis', () => {
    const world = createWorld('powerup-missile', 'normal');
    const initialXp = world.state.xp;
    world.spawnPowerUp('missile', world.state.player.x, world.state.player.y);

    const events = world.step(createInputFrame(0));

    expect(world.state.powerUps).toHaveLength(0);
    expect(world.state.axisLevels.missiles).toBe(1);
    expect(world.state.player.missileDamage).toBe(10);
    expect(world.state.xp).toBe(initialXp);
    expect(events.some((event) => event.type === 'powerup_collected')).toBe(true);
  });

  it('immediately fires the leveled missile at a nearby target on the next tick', () => {
    const world = createWorld('powerup-missile-fire', 'normal');
    world.spawnPowerUp('missile', world.state.player.x, world.state.player.y);
    world.state.enemies.push(targetAt(world.state.player.x + 120, world.state.player.y));

    world.step(createInputFrame(0));
    world.step(createInputFrame(1));

    expect(
      world.state.projectiles.some(
        (projectile) => projectile.owner === 'player' &&
          projectile.kind === 'missile' &&
          projectile.damage === 10,
      ),
    ).toBe(true);
  });

  it('applies every non-missile power-up effect', () => {
    const world = createWorld('powerup-rest', 'normal');
    const player = world.state.player;
    player.hp = 20;

    world.spawnPowerUp('speed', 0, 0);
    world.collectPowerUp(0);
    expect(player.moveSpeed).toBe(240);

    world.spawnPowerUp('shield', 0, 0);
    world.collectPowerUp(0);
    expect(player.maxHp).toBe(125);
    expect(player.hp).toBe(45);

    const initialShotRate = player.shotRate;
    const initialDamage = player.projectileDamage;
    world.spawnPowerUp('blaster', 0, 0);
    world.collectPowerUp(0);
    expect(player.shotRate).toBeCloseTo(initialShotRate + 1.25);
    expect(player.projectileDamage).toBe(initialDamage + 6);

    world.spawnPowerUp('surge', 0, 0);
    world.collectPowerUp(0);
    expect(player.surgeDamage).toBe(36);
    expect(player.surgeDistance).toBe(135);

    player.hp = 20;
    world.spawnPowerUp('health', 0, 0);
    world.collectPowerUp(0);
    expect(player.hp).toBe(50);
  });

  it('accepts fixed-axis plural aliases without creating duplicate types', () => {
    const world = createWorld('powerup-alias', 'normal');
    const missiles = world.spawnPowerUp('missiles', 0, 0);
    const shields = world.spawnPowerUp('shields', 0, 0);

    expect(missiles.type).toBe('missile');
    expect(shields.type).toBe('shield');
    expect(POWER_UP_DEFINITIONS.map((entry) => entry.type)).toContain('missile');
    expect(POWER_UP_DEFINITIONS.map((entry) => entry.type)).toContain('shield');
  });

  it('lets the first enemy kill drop a guaranteed missile pickup', () => {
    const world = createWorld('powerup-first-kill', 'normal');
    world.state.enemies.push(targetAt(world.state.player.x + 120, world.state.player.y));

    let dropped = false;
    for (let tick = 0; tick < 30; tick += 1) {
      const events = world.step(createInputFrame(tick, { aimX: 1, aimY: 0, fire: true }));
      dropped ||= events.some((event) => event.type === 'powerup_dropped');
      if (dropped) break;
    }

    expect(dropped).toBe(true);
    expect(world.state.powerUps[0]?.type).toBe('missile');
  });

  it('collects stacked power-ups safely in one tick', () => {
    const world = createWorld('powerup-stack', 'normal');
    const { x, y } = world.state.player;
    world.spawnPowerUp('missile', x, y);
    world.spawnPowerUp('blaster', x, y);

    world.step(createInputFrame(0));

    expect(world.state.powerUps).toHaveLength(0);
    expect(world.state.axisLevels.missiles).toBe(1);
    expect(world.state.axisLevels.blaster).toBe(1);
    expect(world.collectPowerUp(0)).toBe(false);
  });

  it('expires uncollected power-ups after their lifetime', () => {
    const world = createWorld('powerup-expire', 'normal');
    const powerUp = world.spawnPowerUp('speed', 1000, 100);
    powerUp.lifeMs = 1;

    world.step(createInputFrame(0));

    expect(world.state.powerUps).toHaveLength(0);
  });
});
