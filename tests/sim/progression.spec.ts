import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface CardSpec {
  deck: string;
  text: string;
}

interface UpgradeSpec {
  id: string;
}

function readCards(): CardSpec[] {
  const path = join(process.cwd(), 'src', 'data', 'cards.json');
  return JSON.parse(readFileSync(path, 'utf8')) as CardSpec[];
}

function readUpgrades(): UpgradeSpec[] {
  const path = join(process.cwd(), 'src', 'data', 'upgrades.json');
  return JSON.parse(readFileSync(path, 'utf8')) as UpgradeSpec[];
}

describe('progression content contract', () => {
  it('contains 12 upgrade nodes', () => {
    expect(readUpgrades()).toHaveLength(12);
  });

  it('contains two 8-card decks', () => {
    const cards = readCards();
    const decks = cards.reduce<Record<string, number>>((acc, card) => {
      acc[card.deck] = (acc[card.deck] ?? 0) + 1;
      return acc;
    }, {});

    expect(decks.bulwark).toBe(8);
    expect(decks.tempest).toBe(8);
  });

  it('keeps card text concise for in-run readability', () => {
    for (const card of readCards()) {
      expect(card.text.length).toBeLessThanOrEqual(60);
    }
  });
});
