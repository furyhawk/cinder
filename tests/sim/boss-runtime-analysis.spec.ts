import { describe, expect, it } from 'vitest';
import {
  CORE_ARMOR_MULTIPLIER,
  createBossRuntime,
  damageBossRuntime,
  stepBossRuntime,
  type BossRuntimeEvent,
  type BossRuntimeState,
  type BossSpec,
} from '../../src/sim/boss';
import { bossGenerationForRun, createInputFrame, createWorld } from '../../src/sim/world';
import { validateBossArc } from '../../src/data/validate/bossArc';
import wardenGen1 from '../../src/data/boss.warden.json';
import wardenGen2 from '../../src/data/boss.warden.gen2.json';

const gen1 = wardenGen1 as unknown as BossSpec;
const gen2 = wardenGen2 as unknown as BossSpec;

function stepFor(
  runtime: BossRuntimeState,
  spec: BossSpec,
  ticks: number,
  playerX = 640,
  playerY = 620,
  startTick = 0,
) {
  let state = runtime;
  const events: BossRuntimeEvent[] = [];
  let shots = 0;
  for (let offset = 0; offset < ticks; offset += 1) {
    const result = stepBossRuntime(state, spec, {
      dtMs: 1000 / 60,
      tick: startTick + offset,
      playerX,
      playerY,
    });
    state = result.state;
    events.push(...result.events);
    shots += result.shots.length;
  }
  return { state, events, shots };
}

function stepUntilExposed(
  runtime: BossRuntimeState,
  spec: BossSpec,
  maxTicks = 60 * 5,
): { state: BossRuntimeState; opened: Extract<BossRuntimeEvent, { type: 'boss_module_exposed' }> } {
  let state = runtime;
  for (let tick = 0; tick < maxTicks; tick += 1) {
    const result = stepBossRuntime(state, spec, {
      dtMs: 1000 / 60,
      tick,
      playerX: 640,
      playerY: 620,
    });
    state = result.state;
    const opened = result.events.find(
      (event): event is Extract<BossRuntimeEvent, { type: 'boss_module_exposed' }> =>
        event.type === 'boss_module_exposed' && event.exposed,
    );
    if (opened) {
      return { state, opened };
    }
  }
  throw new Error('Expected a module exposure window');
}

describe('data-driven boss runtime', () => {
  it('validates both Warden generations', () => {
    expect(validateBossArc(gen1).ok).toBe(true);
    expect(validateBossArc(gen2).ok).toBe(true);
  });

  it('scales generation 2 through data only', () => {
    expect(gen2.generation).toBe(2);
    expect(gen2.coreHp!).toBeGreaterThan(gen1.coreHp!);
    expect(gen2.patterns.map((pattern) => pattern.id)).toEqual(
      gen1.patterns.map((pattern) => pattern.id),
    );
  });

  it('selects generation 2 on hard runs and generation 1 elsewhere', () => {
    expect(bossGenerationForRun('easy', 5)).toBe(1);
    expect(bossGenerationForRun('normal', 5)).toBe(1);
    expect(bossGenerationForRun('hard', 5)).toBe(2);
  });

  it('cycles through all five patterns with supervised attack windows', () => {
    const runtime = createBossRuntime(gen1, { x: 640, y: 210 });
    const { events } = stepFor(runtime, gen1, 60 * 30);

    const patternIds = new Set(
      events
        .filter((event) => event.type === 'boss_pattern' && event.phase === 'active')
        .map((event) => (event as { patternId: string }).patternId),
    );

    expect(patternIds.size).toBe(5);
    expect([...patternIds]).toEqual([
      'sweep_fan',
      'ring_burst',
      'spiral_arm',
      'aimed_volley',
      'arena_slam',
    ]);
  });

  it('opens and closes module exposure windows', () => {
    const runtime = createBossRuntime(gen1, { x: 640, y: 210 });
    const exposure = stepUntilExposed(runtime, gen1);

    expect(exposure.opened.moduleId).toBe('left_arm');
    expect(
      exposure.state.modules.find((module) => module.id === 'left_arm')?.exposed,
    ).toBe(true);

    const closed = stepFor(
      exposure.state,
      gen1,
      120,
      undefined,
      undefined,
      120,
    );
    const closeEvent = closed.events.find(
      (event) => event.type === 'boss_module_exposed' && event.exposed === false,
    );
    expect(closeEvent).toBeDefined();
    expect((closeEvent as { moduleId: string }).moduleId).toBe('left_arm');
    expect(
      closed.state.modules.find((module) => module.id === 'left_arm')?.exposed,
    ).toBe(false);
  });

  it('routes damage to exposed modules instead of the armoured core', () => {
    const runtime = createBossRuntime(gen1, { x: 640, y: 210 });
    const { state } = stepUntilExposed(runtime, gen1);
    const exposedModule = state.modules.find((module) => module.exposed && !module.destroyed)!;
    expect(exposedModule).toBeDefined();

    const beforeCore = state.hp;
    const beforeModule = exposedModule.hp;
    const result = damageBossRuntime(state, 25, state.x + exposedModule.offsetX, state.y + exposedModule.offsetY);

    expect(result.state.hp).toBe(beforeCore);
    expect(result.targetModuleId).toBe(exposedModule.id);
    expect(result.state.modules.find((module) => module.id === exposedModule.id)!.hp).toBe(
      beforeModule - 25,
    );
  });

  it('armours the core while modules remain intact', () => {
    const runtime = createBossRuntime(gen1, { x: 640, y: 210 });
    const hit = damageBossRuntime(runtime, 100, runtime.x, runtime.y);

    expect(hit.dealt).toBeCloseTo(100 * CORE_ARMOR_MULTIPLIER, 5);
    expect(hit.state.hp).toBeCloseTo(runtime.maxHp - 100 * CORE_ARMOR_MULTIPLIER, 5);
    expect(hit.defeated).toBe(false);
  });

  it('removes core armour once every module is destroyed', () => {
    const runtime = createBossRuntime(gen1, { x: 640, y: 210 });
    for (const module of runtime.modules) {
      module.destroyed = true;
      module.hp = 0;
    }

    const hit = damageBossRuntime(runtime, 100, runtime.x, runtime.y);
    expect(hit.dealt).toBeCloseTo(100, 5);
    expect(hit.state.hp).toBeCloseTo(runtime.maxHp - 100, 5);
  });

  it('reports defeat when the core reaches zero', () => {
    const runtime = createBossRuntime(gen1, { x: 640, y: 210 });
    runtime.hp = 1;
    for (const module of runtime.modules) {
      module.destroyed = true;
      module.hp = 0;
    }

    const hit = damageBossRuntime(runtime, 100, runtime.x, runtime.y);
    expect(hit.defeated).toBe(true);
    expect(hit.state.hp).toBe(0);
  });

  it('integrates a gen2 boss into hard runs', () => {
    const world = createWorld('boss-hard-gen2', 'hard');
    world.state.wave = 5;
    world.state.waveTimer = 999999;
    world.step(createInputFrame(0));

    expect(world.state.boss).not.toBeNull();
    expect(world.state.boss!.generation).toBe(2);
    expect(world.state.boss!.modules.length).toBeGreaterThan(0);
  });

  it('emits projectile volleys from runtime patterns', () => {
    const runtime = createBossRuntime(gen1, { x: 640, y: 210 });
    const { shots } = stepFor(runtime, gen1, 60 * 2);
    expect(shots).toBeGreaterThan(0);
  });
});
