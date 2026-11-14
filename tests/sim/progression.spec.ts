import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UPGRADE_AXES, upgradeAxisCost } from '../../src/sim/world';

interface UpgradeSpec {
  id: string;
  axis: string;
  label: string;
  description: string;
  cost: number;
  costStep: number;
}

function readUpgrades(): UpgradeSpec[] {
  const path = join(process.cwd(), 'src', 'data', 'upgrades.json');
  return JSON.parse(readFileSync(path, 'utf8')) as UpgradeSpec[];
}

describe('progression content contract', () => {
  it('contains exactly the five fixed upgrade axes', () => {
    expect(readUpgrades().map((upgrade) => upgrade.axis)).toEqual([...UPGRADE_AXES]);
  });

  it('uses ordered level-scaled XP costs for every axis', () => {
    const costs = readUpgrades().map((upgrade) => upgrade.cost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));

    for (const upgrade of readUpgrades()) {
      expect(upgrade.cost).toBe(upgradeAxisCost(upgrade.axis as (typeof UPGRADE_AXES)[number], 0));
      expect(upgrade.costStep).toBeGreaterThan(0);
      expect(upgrade.description.length).toBeLessThanOrEqual(60);
    }
  });
});
