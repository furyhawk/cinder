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
  return JSON.parse(
    readFileSync(join(process.cwd(), 'src', 'data', 'enemies.json'), 'utf8'),
  ) as EnemySpec[];
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

describe('stage three through five enemy rosters', () => {
  it('adds deterministic, authored specialists for each later stage', () => {
    const specs = new Map(readEnemies().map((enemy) => [enemy.id, enemy]));
    for (const stage of [3, 4, 5]) {
      const previous = new Set(enemyTypesForStage(stage - 1));
      const exclusive = enemyTypesForStage(stage).filter(
        (kind) => !previous.has(kind),
      );
      expect(exclusive.length).toBeGreaterThanOrEqual(2);

      for (const kind of exclusive) {
        expect(specs.has(kind)).toBe(true);
        expect(specs.get(kind)?.threat).toBeGreaterThan(0);
        const input = {
          kind,
          x: 100,
          y: 120,
          speed: 150,
          seed: 4242,
          tick: 180,
          playerX: 640,
          playerY: 360,
        } as const;
        expect(stepEnemyBehaviour(input)).toEqual(stepEnemyBehaviour(input));
      }
    }
  });

  it('keeps director plans inside each later stage pool', () => {
    const points = [
      { x: 100, y: 100 },
      { x: 1180, y: 100 },
      { x: 100, y: 620 },
      { x: 1180, y: 620 },
    ];
    for (const stage of [3, 4, 5]) {
      const previous = new Set(enemyTypesForStage(stage - 1));
      const exclusive = enemyTypesForStage(stage).filter(
        (kind) => !previous.has(kind),
      );
      const plan = planWaveSpawns(20, points, { x: 640, y: 360 }, 2, exclusive);
      expect(plan.length).toBeGreaterThan(0);
      expect(plan.every((entry) => exclusive.includes(entry.type))).toBe(true);
    }
  });

  it('gives every new specialist an active ranged attack', () => {
    for (const stage of [3, 4, 5]) {
      const previous = new Set(enemyTypesForStage(stage - 1));
      const exclusive = enemyTypesForStage(stage).filter(
        (kind) => !previous.has(kind),
      );

      for (const kind of exclusive) {
        const world = createWorld(`stage-late-fire-${stage}-${kind}`, 'normal');
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
          world.state.projectiles.some(
            (projectile) => projectile.owner === 'enemy',
          ),
        ).toBe(true);
      }
    }
  });

  it('spawns late-stage archetypes only in their authored stage and above', () => {
    for (const stage of [3, 4, 5]) {
      const previous = new Set(enemyTypesForStage(stage - 1));
      const exclusive = new Set(
        enemyTypesForStage(stage).filter((kind) => !previous.has(kind)),
      );
      const world = createWorld(`late-roster-${stage}`, 'normal', {
        bossWarningMs: 0,
        stageTransitionMs: 0,
      });
      forceStage(world, stage);
      world.step(createInputFrame(0));
      expect(world.state.enemies.some((enemy) => exclusive.has(enemy.kind))).toBe(
        true,
      );
    }
  });
});
