import { describe, expect, it } from 'vitest';
import {
  bossSpecForStage,
  createInputFrame,
  createWorld,
  firstWaveForStage,
  STAGE_COUNT,
  STAGE_DEFINITIONS,
  type World,
} from '../../src/sim/world';
import { validateBossArc } from '../../src/data/validate/bossArc';
import type { BossSpec } from '../../src/sim/boss';
import forgeheart from '../../src/data/boss.forgeheart.json';

function spawnBoss(world: World, tick: number): void {
  world.state.waveTimer = 999999;
  for (let attempt = 0; attempt < 5 && world.state.boss === null; attempt += 1) {
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

function forceSecondBossReady(world: World): void {
  world.state.enemies.length = 0;
  world.state.waveBreakMs = null;
  world.state.miniWaveBreakMs = null;
  world.state.miniWaveBudgets = [];
  world.state.stageTransitionMs = 0;
  world.state.stageAwaitingFirstWave = false;
  world.state.stageWave = (world.state.stageWaveTotal ?? 5) + 1;
  world.state.wave = firstWaveForStage(2) + (world.state.stageWaveTotal ?? 5);
  world.state.waveTimer = 999999;
}

describe('two-stage campaign progression', () => {
  it('defines a dedicated second stage and second boss', () => {
    expect(STAGE_COUNT).toBe(2);
    expect(STAGE_DEFINITIONS[0]?.bossId).toBe('warden');
    expect(STAGE_DEFINITIONS[1]?.bossId).toBe('forgeheart');

    const firstBoss = bossSpecForStage(1, 'normal', 5);
    const secondBoss = bossSpecForStage(2, 'normal', 10);
    expect(firstBoss.id).toBe('warden');
    expect(secondBoss.id).toBe('forgeheart');
    expect(secondBoss.generation).toBe(2);
    expect(secondBoss.id).not.toBe(firstBoss.id);
    expect(validateBossArc(secondBoss as unknown as BossSpec).ok).toBe(true);
    expect(validateBossArc(forgeheart as unknown as BossSpec).ok).toBe(true);
  });

  it('hands off the first boss kill to stage two and only wins after the second boss', () => {
    const world = createWorld('two-stage-run', 'normal', {
      bossWarningMs: 0,
      stageTransitionMs: 120,
    });
    world.state.player.hp = 1_000_000;
    world.state.player.maxHp = 1_000_000;

    // Stage one boss.
    world.state.wave = 5;
    spawnBoss(world, 0);
    expect(world.state.stage).toBe(1);
    expect(world.state.boss?.specId).toBe('warden');
    expect(world.state.boss?.generation).toBe(1);

    const firstKillEvents = defeatBoss(world, 10);
    expect(world.state.status).toBe('playing');
    expect(world.state.stage).toBe(2);
    expect(world.state.stageName).toBe('FORGE CORE');
    expect(world.state.boss).toBeNull();
    expect(world.state.bossesDefeated).toBe(1);
    expect(world.state.stageTransitionMs).toBe(120);
    expect(firstKillEvents.some((event) => event.type === 'stage_clear')).toBe(true);
    expect(
      firstKillEvents.some(
        (event) =>
          event.type === 'stage_transition' &&
          event.data?.phase === 'started' &&
          Number(event.data?.stage) === 2,
      ),
    ).toBe(true);
    expect(firstKillEvents.some((event) => event.type === 'run_ended')).toBe(false);

    // The transition ends, then the first stage-two wave begins.
    for (let tick = 20; tick < 180; tick += 1) {
      world.step(createInputFrame(tick));
    }
    expect(world.state.stageTransitionMs).toBe(0);
    expect(world.state.activeWave).toBe(firstWaveForStage(2));
    expect(world.state.enemies.length).toBeGreaterThan(0);

    // Fast-forward to the second boss arrival and defeat it.
    forceSecondBossReady(world);
    spawnBoss(world, 200);
    expect(world.state.boss?.specId).toBe('forgeheart');
    expect(world.state.boss?.displayName).toBe('FORGEHEART');

    const secondKillEvents = defeatBoss(world, 210);
    expect(world.state.status).toBe('won');
    expect(world.state.bossesDefeated).toBe(2);
    expect(
      secondKillEvents.some(
        (event) =>
          event.type === 'run_ended' &&
          event.data?.outcome === 'victory' &&
          Number(event.data?.bossesDefeated) === 2,
      ),
    ).toBe(true);
  });

  it('keeps stage one generation selection unchanged', () => {
    expect(bossSpecForStage(1, 'easy', 5).generation).toBe(1);
    expect(bossSpecForStage(1, 'normal', 5).generation).toBe(1);
    expect(bossSpecForStage(1, 'hard', 5).generation).toBe(2);
    expect(bossSpecForStage(2, 'easy', 10).id).toBe('forgeheart');
    expect(bossSpecForStage(2, 'hard', 10).id).toBe('forgeheart');
  });
});
