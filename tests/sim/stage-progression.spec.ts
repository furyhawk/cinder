import { describe, expect, it } from 'vitest';
import {
  bossSpecForStage,
  createInputFrame,
  createWorld,
  enemyTypesForStage,
  firstWaveForStage,
  STAGE_COUNT,
  STAGE_DEFINITIONS,
  type World,
} from '../../src/sim/world';
import { validateBossArc } from '../../src/data/validate/bossArc';
import type { BossSpec } from '../../src/sim/boss';
import wardenGen1 from '../../src/data/boss.warden.json';
import wardenGen2 from '../../src/data/boss.warden.gen2.json';
import forgeheart from '../../src/data/boss.forgeheart.json';
import slagmaw from '../../src/data/boss.slagmaw.json';
import obsidianSeraph from '../../src/data/boss.obsidian_seraph.json';
import cinderSovereign from '../../src/data/boss.cinder_sovereign.json';

function spawnBoss(world: World, tick: number): void {
  world.state.waveTimer = 999999;
  for (let attempt = 0; attempt < 8 && world.state.boss === null; attempt += 1) {
    world.step(createInputFrame(tick + attempt));
  }
  expect(world.state.boss).not.toBeNull();
}

function defeatBoss(world: World, tick: number): ReturnType<World['step']> {
  const boss = world.state.boss;
  if (!boss) throw new Error('Expected an active boss');
  boss.hp = 1;
  for (const module of boss.modules) {
    module.destroyed = true;
    module.hp = 0;
  }
  world.state.projectiles.push({
    x: boss.x,
    y: boss.y,
    vx: 0,
    vy: 0,
    radius: 5,
    damage: Math.max(100, boss.maxHp),
    life: 100,
    owner: 'player',
    kind: 'blaster',
  });
  return world.step(createInputFrame(tick));
}

function forceBossReady(world: World, stage: number): void {
  const definition = STAGE_DEFINITIONS[stage - 1]!;
  world.state.stage = stage;
  world.state.stageName = definition.name;
  world.state.stageWave = definition.waveCount + 1;
  world.state.stageWaveTotal = definition.waveCount;
  world.state.wave = firstWaveForStage(stage) + definition.waveCount;
  world.state.activeWave = 0;
  world.state.miniWave = 0;
  world.state.miniWaveTotal = 0;
  world.state.miniWaveBudgets = [];
  world.state.miniWaveBreakMs = null;
  world.state.waveBreakMs = null;
  world.state.stageTransitionMs = 0;
  world.state.stageAwaitingFirstWave = false;
  world.state.boss = null;
  world.state.bossWarningMs = 0;
  world.state.enemies.length = 0;
  world.state.waveTimer = 999999;
}

describe('five-stage campaign progression', () => {
  it('defines five unique stages and fairness-validated bosses', () => {
    expect(STAGE_COUNT).toBe(5);
    expect(STAGE_DEFINITIONS.map((stage) => stage.id)).toEqual([
      'foundry',
      'forgeheart',
      'slagworks',
      'obsidian_vault',
      'crucible',
    ]);
    expect(STAGE_DEFINITIONS.map((stage) => stage.bossId)).toEqual([
      'warden',
      'forgeheart',
      'slagmaw',
      'obsidian_seraph',
      'cinder_sovereign',
    ]);

    const bossIds = new Set<string>();
    const specs = [
      wardenGen1,
      wardenGen2,
      forgeheart,
      slagmaw,
      obsidianSeraph,
      cinderSovereign,
    ] as unknown as BossSpec[];
    for (const spec of specs) {
      expect(validateBossArc(spec).ok).toBe(true);
      bossIds.add(spec.id);
    }
    expect(bossIds.size).toBe(5);

    for (let stage = 1; stage <= STAGE_COUNT; stage += 1) {
      const stageBoss = bossSpecForStage(
        stage,
        'normal',
        firstWaveForStage(stage) + STAGE_DEFINITIONS[stage - 1]!.waveCount,
      );
      expect(stageBoss.id).toBe(STAGE_DEFINITIONS[stage - 1]!.bossId);
      expect(validateBossArc(stageBoss).ok).toBe(true);
    }
  });

  it('adds stage-specific enemy archetypes at every escalation', () => {
    for (let stage = 2; stage <= STAGE_COUNT; stage += 1) {
      const previous = new Set(enemyTypesForStage(stage - 1));
      const exclusive = enemyTypesForStage(stage).filter((kind) => !previous.has(kind));
      expect(exclusive.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('hands off each boss kill to the next stage and only wins after stage five', () => {
    const world = createWorld('five-stage-run', 'normal', {
      bossWarningMs: 0,
      stageTransitionMs: 120,
    });
    world.state.player.hp = 1_000_000;
    world.state.player.maxHp = 1_000_000;

    for (let stage = 1; stage <= STAGE_COUNT; stage += 1) {
      forceBossReady(world, stage);
      spawnBoss(world, stage * 100);
      expect(world.state.stage).toBe(stage);
      expect(world.state.boss?.specId).toBe(STAGE_DEFINITIONS[stage - 1]!.bossId);

      const killEvents = defeatBoss(world, stage * 100 + 10);
      expect(world.state.bossesDefeated).toBe(stage);
      expect(killEvents.some((event) => event.type === 'stage_clear')).toBe(true);

      if (stage < STAGE_COUNT) {
        expect(world.state.status).toBe('playing');
        expect(world.state.stage).toBe(stage + 1);
        expect(world.state.stageName).toBe(STAGE_DEFINITIONS[stage]!.name);
        expect(world.state.boss).toBeNull();
        expect(world.state.stageTransitionMs).toBe(120);
        expect(
          killEvents.some(
            (event) =>
              event.type === 'stage_transition' &&
              event.data?.phase === 'started' &&
              Number(event.data?.stage) === stage + 1,
          ),
        ).toBe(true);
        expect(killEvents.some((event) => event.type === 'run_ended')).toBe(false);
      } else {
        expect(world.state.status).toBe('won');
        expect(
          killEvents.some(
            (event) =>
              event.type === 'run_ended' &&
              event.data?.outcome === 'victory' &&
              Number(event.data?.bossesDefeated) === STAGE_COUNT,
          ),
        ).toBe(true);
      }
    }
  });

  it('starts the next stage first wave after its transition', () => {
    const world = createWorld('five-stage-transition', 'normal', {
      bossWarningMs: 0,
      stageTransitionMs: 120,
    });
    world.state.player.hp = 1_000_000;
    world.state.player.maxHp = 1_000_000;

    forceBossReady(world, 1);
    spawnBoss(world, 0);
    defeatBoss(world, 10);
    for (let tick = 20; tick < 180; tick += 1) {
      world.step(createInputFrame(tick));
    }

    expect(world.state.stage).toBe(2);
    expect(world.state.stageTransitionMs).toBe(0);
    expect(world.state.activeWave).toBe(firstWaveForStage(2));
    expect(world.state.enemies.length).toBeGreaterThan(0);
  });

  it('keeps stage one generation selection unchanged', () => {
    expect(bossSpecForStage(1, 'easy', 5).generation).toBe(1);
    expect(bossSpecForStage(1, 'normal', 5).generation).toBe(1);
    expect(bossSpecForStage(1, 'hard', 5).generation).toBe(2);
    expect(bossSpecForStage(2, 'easy', 10).id).toBe('forgeheart');
    expect(bossSpecForStage(2, 'hard', 10).id).toBe('forgeheart');
  });
});
