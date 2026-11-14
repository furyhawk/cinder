import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateBossArc, type BossSpec } from '../../src/data/validate/bossArc';

function readBoss(): BossSpec {
  return JSON.parse(readFileSync(join(process.cwd(), 'src/data/boss.warden.json'), 'utf8')) as BossSpec;
}

describe('boss arc validator', () => {
  it('passes current warden data', () => {
    const result = validateBossArc(readBoss());
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails deliberately broken fixture', () => {
    const broken: BossSpec = {
      generation: 1,
      modules: [{ id: 'core', exposesDuringPattern: 'only' }],
      patterns: [
        {
          id: 'only',
          durationMs: 2000,
          telegraphMs: 150,
          vulnerableWindowMs: 200,
        },
      ],
    };

    const result = validateBossArc(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
