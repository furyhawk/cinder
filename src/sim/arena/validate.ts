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
