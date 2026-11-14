import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface EnemySpec {
  behaviour: string;
  silhouette: number;
}

function readEnemies(): EnemySpec[] {
  const path = join(process.cwd(), 'src', 'data', 'enemies.json');
  return JSON.parse(readFileSync(path, 'utf8')) as EnemySpec[];
}

describe('enemy silhouettes', () => {
  it('maps each behaviour class to exactly one silhouette and no silhouette is shared', () => {
    const enemies = readEnemies();
    expect(enemies.length).toBeGreaterThanOrEqual(10);
    const behaviourToSilhouette = new Map<string, number>();
    const silhouetteToBehaviour = new Map<number, string>();

    for (const enemy of enemies) {
      const existingSilhouette = behaviourToSilhouette.get(enemy.behaviour);
      if (existingSilhouette !== undefined) {
        expect(enemy.silhouette).toBe(existingSilhouette);
      } else {
        behaviourToSilhouette.set(enemy.behaviour, enemy.silhouette);
      }

      const existingBehaviour = silhouetteToBehaviour.get(enemy.silhouette);
      if (existingBehaviour !== undefined) {
        expect(enemy.behaviour).toBe(existingBehaviour);
      } else {
        silhouetteToBehaviour.set(enemy.silhouette, enemy.behaviour);
      }
    }
  });
});
