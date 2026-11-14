import type { EnemyType } from '../world';

export interface SpawnPoint {
  x: number;
  y: number;
}

export interface SpawnPlanEntry {
  type: EnemyType;
  delayMs: number;
  point: SpawnPoint;
  threat: number;
}

const threatCost: Record<EnemyType, number> = {
  drone: 1,
  runner: 1,
  orbiter: 2,
  charger: 2,
  turret: 2,
  spinner: 3,
  splitter: 3,
  lancer: 3,
};

const spawnOrder: EnemyType[] = [
  'lancer',
  'splitter',
  'spinner',
  'turret',
  'charger',
  'orbiter',
  'runner',
  'drone',
];

function distanceSquared(a: SpawnPoint, b: SpawnPoint): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function nearestValid(points: SpawnPoint[], player: SpawnPoint): SpawnPoint[] {
  return points.filter((point) => distanceSquared(point, player) >= 120 * 120);
}

export function planWaveSpawns(
  threatBudget: number,
  points: SpawnPoint[],
  player: SpawnPoint,
): SpawnPlanEntry[] {
  const validPoints = nearestValid(points, player);
  const usablePoints = validPoints.length > 0 ? validPoints : points;
  const result: SpawnPlanEntry[] = [];
  let remaining = threatBudget;
  let pointIndex = 0;

  while (remaining > 0) {
    const nextType = spawnOrder.find((type) => threatCost[type] <= remaining);
    if (!nextType) break;

    result.push({
      type: nextType,
      delayMs: 600,
      point: usablePoints[pointIndex % usablePoints.length],
      threat: threatCost[nextType],
    });
    remaining -= threatCost[nextType];
    pointIndex += 1;
  }

  return result;
}

