import type { Point } from './geometry';
import { polygonBounds } from './geometry';

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = (yi > py) !== (yj > py)
      && px < ((xj - xi) * (py - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const [px, py] = point;
  const [ax, ay] = a;
  const [bx, by] = b;
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSquared = abx * abx + aby * aby;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lengthSquared))
    : 0;
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

export function distanceToPolygonBoundary(point: Point, polygon: Point[]): number {
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    closest = Math.min(closest, distanceToSegment(point, a, b));
  }
  return closest;
}

export function polygonCentroid(polygon: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const point of polygon) {
    x += point[0];
    y += point[1];
  }
  return [x / polygon.length, y / polygon.length];
}

export function isPositionSafe(point: Point, polygon: Point[], clearance = 0): boolean {
  return pointInPolygon(point, polygon) && distanceToPolygonBoundary(point, polygon) >= clearance;
}

/**
 * Deterministic relocation target for an entity stranded outside (or too close
 * to the edge of) the active arena. Never returns a point outside the polygon
 * as long as the polygon has any interior area at all.
 */
export function findSafeInteriorPoint(
  polygon: Point[],
  desired: Point,
  clearance = 0,
): Point {
  if (isPositionSafe(desired, polygon, clearance)) {
    return desired;
  }

  const centroid = polygonCentroid(polygon);
  for (let step = 1; step <= 32; step += 1) {
    const t = step / 32;
    const candidate: Point = [
      desired[0] + (centroid[0] - desired[0]) * t,
      desired[1] + (centroid[1] - desired[1]) * t,
    ];
    if (isPositionSafe(candidate, polygon, clearance)) {
      return candidate;
    }
  }

  const bounds = polygonBounds(polygon);
  let best: Point | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let y = bounds.minY + clearance; y <= bounds.maxY - clearance; y += 8) {
    for (let x = bounds.minX + clearance; x <= bounds.maxX - clearance; x += 8) {
      const candidate: Point = [x, y];
      if (!isPositionSafe(candidate, polygon, clearance)) continue;
      const distance = (x - desired[0]) ** 2 + (y - desired[1]) ** 2;
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }

  return best ?? centroid;
}

export function estimateReachableRadius(polygon: Point[], sampleStep = 32): number {
  const bounds = polygonBounds(polygon);
  let insideCount = 0;

  for (let y = bounds.minY; y <= bounds.maxY; y += sampleStep) {
    for (let x = bounds.minX; x <= bounds.maxX; x += sampleStep) {
      if (pointInPolygon([x, y], polygon)) {
        insideCount += 1;
      }
    }
  }

  if (insideCount <= 0) return 0;
  const areaApprox = insideCount * sampleStep * sampleStep;
  return Math.sqrt(areaApprox / Math.PI);
}

export function isMutationSafe(polygon: Point[], minReachableRadius = 160): boolean {
  return estimateReachableRadius(polygon) >= minReachableRadius;
}
