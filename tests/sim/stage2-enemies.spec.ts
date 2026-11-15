import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInputFrame,
  createWorld,
  enemyTypesForStage,
  firstWaveForStage,
  type EnemyState,
  type EnemyType,
} from '../../src/sim/world';
import { planWaveSpawns } from '../../src/sim/systems/director';
import { stepEnemyBehaviour } from '../../src/sim/entities/enemy';

interface EnemySpec {
  id: string;
  behaviour: string;
  silhouette: number;
  threat: number;
}

function readEnemies(): EnemySpec[] {
  const path = join(process.cwd(), 'src', 'data', 'enemies.json');
  return JSON.parse(readFileSync(path, 'utf8')) as EnemySpec[];
}

function forceStage(world: ReturnType<typeof createWorld>, stage: number): void {
  world.state.stage = stage;
  world.state.stageWave = 1;
  world.state.stageWaveTotal = 5;
  world.state.stageTransitionMs = 0;
  world.state.stageAwaitingFirstWave = false;
  world.state.boss = null;
  world.state.bossWarningMs = 0;
  world.state.enemies.length = 0;
  world.state.waveBreakMs = null;
  world.state.miniWaveBreakMs = null;
  world.state.miniWaveBudgets = [];
  world.state.wave = firstWaveForStage(stage);
  world.state.waveTimer = 999999;
}

describe('stage two enemy roster', () => {
  it('adds stage-two-only enemy archetypes to the authored enemy data', () => {
    const stageOne = enemyTypesForStage(1);
    const stageTwo = enemyTypesForStage(2);
    const exclusive = stageTwo.filter((kind) => !stageOne.includes(kind));

    expect(exclusive.length).toBeGreaterThanOrEqual(2);
    const specs = new Map(readEnemies().map((enemy) => [enemy.id, enemy]));
    for (const kind of exclusive) {
      expect(specs.has(kind)).toBe(true);
      expect(specs.get(kind)?.threat).toBeGreaterThan(0);
      expect(
        stepEnemyBehaviour({
          kind,
          x: 100,
          y: 120,
          speed: 150,
          seed: 4242,
          tick: 180,
          playerX: 640,
          playerY: 360,
        }),
      ).toEqual(
        stepEnemyBehaviour({
          kind,
          x: 100,
          y: 120,
          speed: 150,
          seed: 4242,
          tick: 180,
          playerX: 640,
          playerY: 360,
        }),
      );
    }
  });

  it('keeps director plans inside the stage-specific enemy pool', () => {
    const stageTwoOnly = enemyTypesForStage(2).filter(
      (kind) => !enemyTypesForStage(1).includes(kind),
    );
    const points = [
      { x: 100, y: 100 },
      { x: 1180, y: 100 },
      { x: 100, y: 620 },
      { x: 1180, y: 620 },
    ];
    const plan = planWaveSpawns(20, points, { x: 640, y: 360 }, 2, stageTwoOnly);

    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((entry) => stageTwoOnly.includes(entry.type))).toBe(true);
  });

  it('gives every stage-two specialist an active ranged attack', () => {
    const exclusive = enemyTypesForStage(2).filter(
      (kind) => !enemyTypesForStage(1).includes(kind),
    );

    for (const kind of exclusive) {
      const world = createWorld(`stage-two-fire-${kind}`, 'normal');
      world.state.player.hp = 1_000_000;
      world.state.player.maxHp = 1_000_000;
      const enemy: EnemyState = {
        id: 1,
        kind: kind as EnemyType,
        x: world.state.player.x + 200,
        y: world.state.player.y,
        vx: 0,
        vy: 0,
        radius: 18,
        hp: 100,
        maxHp: 100,
        speed: 0,
        contactDamage: 0,
        fireCooldown: 0,
        seed: 1,
        spawnWarningMs: 0,
      };
      world.state.enemies.push(enemy);
      world.step(createInputFrame(0));

      expect(
        world.state.projectiles.some((projectile) => projectile.owner === 'enemy'),
      ).toBe(true);
    }
  });

  it('spawns stage-two archetypes during stage two while stage one stays unchanged', () => {
    const exclusive = new Set(
      enemyTypesForStage(2).filter((kind) => !enemyTypesForStage(1).includes(kind)),
    );

    const stageOneWorld = createWorld('stage-one-roster', 'normal', {
      bossWarningMs: 0,
      stageTransitionMs: 0,
    });
    forceStage(stageOneWorld, 1);
    stageOneWorld.step(createInputFrame(0));
    expect(stageOneWorld.state.enemies.some((enemy) => exclusive.has(enemy.kind))).toBe(
      false,
    );

    const stageTwoWorld = createWorld('stage-two-roster', 'normal', {
      bossWarningMs: 0,
      stageTransitionMs: 0,
    });
    forceStage(stageTwoWorld, 2);
    stageTwoWorld.step(createInputFrame(0));
    expect(stageTwoWorld.state.enemies.some((enemy) => exclusive.has(enemy.kind))).toBe(
      true,
    );
  });
});
