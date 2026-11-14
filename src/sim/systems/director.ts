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
  weaver: 2,
  bomber: 4,
};

const spawnOrder: EnemyType[] = [
  'bomber',
  'lancer',
  'splitter',
  'spinner',
  'weaver',
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

function selectSpreadPoint(
  points: SpawnPoint[],
  player: SpawnPoint,
  selected: SpawnPoint[],
): SpawnPoint {
  if (selected.length === 0) {
    let best = points[0];
    let bestDistance = -1;
    for (const point of points) {
      const candidateDistance = distanceSquared(point, player);
      if (candidateDistance > bestDistance) {
        best = point;
        bestDistance = candidateDistance;
      }
    }
    return best;
  }

  let best = points[0];
  let bestSeparation = -1;
  for (const point of points) {
    let nearestSelected = Number.POSITIVE_INFINITY;
    for (const chosen of selected) {
      nearestSelected = Math.min(nearestSelected, distanceSquared(point, chosen));
    }
    if (nearestSelected > bestSeparation) {
      best = point;
      bestSeparation = nearestSelected;
    }
  }
  return best;
}

export function planWaveSpawns(
  threatBudget: number,
  points: SpawnPoint[],
  player: SpawnPoint,
): SpawnPlanEntry[] {
  const validPoints = nearestValid(points, player);
  const usablePoints = validPoints.length > 0 ? validPoints : points;
  const result: SpawnPlanEntry[] = [];
  const selected: SpawnPoint[] = [];
  const available = [...usablePoints];
  let remaining = threatBudget;

  while (remaining > 0) {
    const nextType = spawnOrder.find((type) => threatCost[type] <= remaining);
    if (!nextType) break;

    if (available.length === 0) {
      available.push(...usablePoints);
    }
    const point = selectSpreadPoint(available, player, selected);
    available.splice(available.indexOf(point), 1);
    selected.push(point);

    result.push({
      type: nextType,
      delayMs: 600,
      point,
      threat: threatCost[nextType],
    });
    remaining -= threatCost[nextType];
  }

  return result;
}

