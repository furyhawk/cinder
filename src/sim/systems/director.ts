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

export const ENEMY_THREAT_COST: Record<EnemyType, number> = {
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
  sentinel: 4,
  mortar: 4,
  juggernaut: 5,
};

/** Highest-threat first; stage pools filter this ordering. */
export const ENEMY_SPAWN_ORDER: readonly EnemyType[] = [
  'juggernaut',
  'sentinel',
  'mortar',
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
  minimumSpawnsOrAllowedTypes: number | readonly EnemyType[] = 1,
  allowedTypes: readonly EnemyType[] = ENEMY_SPAWN_ORDER,
): SpawnPlanEntry[] {
  const validPoints = nearestValid(points, player);
  const usablePoints = validPoints.length > 0 ? validPoints : points;
  const result: SpawnPlanEntry[] = [];
  const selected: SpawnPoint[] = [];
  const available = [...usablePoints];
  const minimumSpawns =
    typeof minimumSpawnsOrAllowedTypes === 'number' ? minimumSpawnsOrAllowedTypes : 1;
  const typePool =
    typeof minimumSpawnsOrAllowedTypes === 'number'
      ? allowedTypes
      : minimumSpawnsOrAllowedTypes;
  const minSpawns = Math.max(1, Math.floor(minimumSpawns));
  const allowed = new Set(typePool);
  const spawnOrder = ENEMY_SPAWN_ORDER.filter((type) => allowed.has(type));
  if (spawnOrder.length === 0) return result;
  let remaining = threatBudget;

  while (remaining > 0) {
    // Reserve one threat for each still-required spawn so a mini-wave can
    // never collapse into a single expensive enemy when it was meant to feel
    // like a group. Once the minimum is met, keep the original high-threat
    // first ordering for wave variety.
    const spawnsStillRequired = Math.max(0, minSpawns - result.length);
    const spendable = remaining - Math.max(0, spawnsStillRequired - 1);
    const nextType =
      spawnOrder.find((type) => ENEMY_THREAT_COST[type] <= spendable) ??
      spawnOrder.find((type) => ENEMY_THREAT_COST[type] <= remaining);
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
      threat: ENEMY_THREAT_COST[nextType],
    });
    remaining -= ENEMY_THREAT_COST[nextType];
  }

  return result;
}

