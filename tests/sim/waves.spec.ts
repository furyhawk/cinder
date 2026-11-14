import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface WaveSpec {
  id: string;
  threatBudget: number;
}

function readWaves(): WaveSpec[] {
  const path = join(process.cwd(), 'src', 'data', 'waves.foundry.json');
  return JSON.parse(readFileSync(path, 'utf8')) as WaveSpec[];
}

describe('foundry wave pacing', () => {
  it('has monotonic non-decreasing threat budgets for non-boss waves', () => {
    const nonBoss = readWaves().filter((wave) => !wave.id.includes('boss'));
    expect(nonBoss.length).toBeGreaterThan(0);

    let previous = nonBoss[0].threatBudget;
    for (let index = 1; index < nonBoss.length; index += 1) {
      const current = nonBoss[index].threatBudget;
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('matches target bounds for first and eighth waves', () => {
    const waves = readWaves().filter((wave) => !wave.id.includes('boss'));
    expect(waves[0]?.threatBudget).toBeLessThanOrEqual(6);
    expect(waves[7]?.threatBudget).toBeLessThanOrEqual(34);
  });
});
