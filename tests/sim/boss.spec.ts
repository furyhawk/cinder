import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface BossPattern {
  telegraphMs: number;
  vulnerableWindowMs: number;
}

interface BossSpec {
  generation: 1 | 2;
  phaseThresholds: number[];
  patterns: BossPattern[];
}

function readBoss(): BossSpec {
  const path = join(process.cwd(), 'src', 'data', 'boss.warden.json');
  return JSON.parse(readFileSync(path, 'utf8')) as BossSpec;
}

describe('warden boss fairness invariants', () => {
  it('ensures vulnerable windows are always present', () => {
    const boss = readBoss();
    for (const pattern of boss.patterns) {
      expect(pattern.vulnerableWindowMs).toBeGreaterThanOrEqual(600);
    }
  });

  it('enforces telegraph floor for generation 1 data', () => {
    const boss = readBoss();
    const floor = boss.generation === 1 ? 400 : 300;
    for (const pattern of boss.patterns) {
      expect(pattern.telegraphMs).toBeGreaterThanOrEqual(floor);
    }
  });

  it('keeps phase thresholds strictly descending', () => {
    const boss = readBoss();
    for (let index = 1; index < boss.phaseThresholds.length; index += 1) {
      expect(boss.phaseThresholds[index]).toBeLessThan(boss.phaseThresholds[index - 1]);
    }
  });
});
