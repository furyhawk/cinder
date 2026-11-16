import { describe, expect, it } from 'vitest';
import {
  createBossRuntime,
  stepBossRuntime,
  type BossRuntimeEvent,
  type BossRuntimeState,
  type BossSpec,
} from '../../src/sim/boss';
import { validateBossArc } from '../../src/data/validate/bossArc';
import slagmaw from '../../src/data/boss.slagmaw.json';
import obsidianSeraph from '../../src/data/boss.obsidian_seraph.json';
import cinderSovereign from '../../src/data/boss.cinder_sovereign.json';

const specs = [
  slagmaw,
  obsidianSeraph,
  cinderSovereign,
] as unknown as BossSpec[];

function stepFor(
  runtime: BossRuntimeState,
  spec: BossSpec,
  ticks: number,
): { state: BossRuntimeState; events: BossRuntimeEvent[]; shots: number } {
  let state = runtime;
  const events: BossRuntimeEvent[] = [];
  let shots = 0;
  for (let tick = 0; tick < ticks; tick += 1) {
    const result = stepBossRuntime(state, spec, {
      dtMs: 1000 / 60,
      tick,
      playerX: 640,
      playerY: 620,
    });
    state = result.state;
    events.push(...result.events);
    shots += result.shots.length;
  }
  return { state, events, shots };
}

describe('late-stage boss arcs', () => {
  it('validates every new boss with targetable weak points and fair telegraphs', () => {
    for (const spec of specs) {
      const validation = validateBossArc(spec);
      expect(validation.errors).toEqual([]);
      expect(validation.ok).toBe(true);
      expect(spec.patterns).toHaveLength(5);
      expect(spec.modules.length).toBeGreaterThanOrEqual(4);
      expect(spec.coreHp).toBeGreaterThan(0);
    }
  });

  it('cycles all patterns and emits deterministic volleys at runtime', () => {
    for (const spec of specs) {
      const runtime = createBossRuntime(spec, { x: 640, y: 210 });
      const first = stepFor(runtime, spec, 60 * 30);
      const second = stepFor(runtime, spec, 60 * 30);
      expect(first.shots).toBeGreaterThan(0);
      expect(first.events).toEqual(second.events);
      expect(first.shots).toBe(second.shots);

      const activePatterns = new Set(
        first.events
          .filter(
            (event) =>
              event.type === 'boss_pattern' && event.phase === 'active',
          )
          .map((event) => (event as { patternId: string }).patternId),
      );
      expect(activePatterns.size).toBe(5);
    }
  });

  it('opens at least one exposure window for every new boss', () => {
    for (const spec of specs) {
      const runtime = createBossRuntime(spec, { x: 640, y: 210 });
      const { events } = stepFor(runtime, spec, 60 * 30);
      expect(
        events.some(
          (event) => event.type === 'boss_module_exposed' && event.exposed,
        ),
      ).toBe(true);
    }
  });
});
