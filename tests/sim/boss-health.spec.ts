import { describe, expect, it } from 'vitest';
import { createBossRuntime, type BossSpec } from '../../src/sim/boss';
import wardenGen1 from '../../src/data/boss.warden.json';
import wardenGen2 from '../../src/data/boss.warden.gen2.json';

const gen1 = wardenGen1 as unknown as BossSpec;
const gen2 = wardenGen2 as unknown as BossSpec;

describe('Warden health tuning', () => {
  it('keeps generation 1 core and module health at 10x the original values', () => {
    expect(gen1.coreHp).toBe(240 * 10);
    expect(gen1.modules.map((module) => [module.id, module.hp])).toEqual([
      ['core', 220 * 10],
      ['left_arm', 110 * 10],
      ['right_arm', 110 * 10],
      ['reactor', 140 * 10],
    ]);

    const runtime = createBossRuntime(gen1);
    expect(runtime.maxHp).toBe(2400);
    expect(runtime.modules.map((module) => [module.id, module.maxHp])).toEqual([
      ['left_arm', 1100],
      ['right_arm', 1100],
      ['reactor', 1400],
    ]);
  });

  it('scales generation 2 health by the same 10x baseline', () => {
    expect(gen2.coreHp).toBe(320 * 10);
    expect(gen2.modules.map((module) => [module.id, module.hp])).toEqual([
      ['core', 320 * 10],
      ['left_arm', 165 * 10],
      ['right_arm', 165 * 10],
      ['reactor', 210 * 10],
    ]);

    const runtime = createBossRuntime(gen2);
    expect(runtime.maxHp).toBe(3200);
    expect(runtime.modules.map((module) => [module.id, module.maxHp])).toEqual([
      ['left_arm', 1650],
      ['right_arm', 1650],
      ['reactor', 2100],
    ]);
  });
});
