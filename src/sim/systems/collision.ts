export interface CircleBody {
  id: number;
  x: number;
  y: number;
  radius: number;
}

export interface Pair {
  a: number;
  b: number;
}

function keyForCell(cellX: number, cellY: number): string {
  return `${cellX},${cellY}`;
}

function overlaps(a: CircleBody, b: CircleBody): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = a.radius + b.radius;
  return (dx * dx) + (dy * dy) <= radius * radius;
}

export function broadphasePairs(
  bodies: CircleBody[],
  cellSize = 64,
): Pair[] {
  const cells = new Map<string, number[]>();

  for (let index = 0; index < bodies.length; index += 1) {
    const body = bodies[index];
    const minX = Math.floor((body.x - body.radius) / cellSize);
    const maxX = Math.floor((body.x + body.radius) / cellSize);
    const minY = Math.floor((body.y - body.radius) / cellSize);
    const maxY = Math.floor((body.y + body.radius) / cellSize);

    for (let cx = minX; cx <= maxX; cx += 1) {
      for (let cy = minY; cy <= maxY; cy += 1) {
        const key = keyForCell(cx, cy);
        const slot = cells.get(key);
        if (slot) {
          slot.push(index);
        } else {
          cells.set(key, [index]);
        }
      }
    }
  }

  const pairSet = new Set<string>();
  const result: Pair[] = [];

  for (const indices of cells.values()) {
    for (let i = 0; i < indices.length; i += 1) {
      for (let j = i + 1; j < indices.length; j += 1) {
        const a = indices[i];
        const b = indices[j];
        const first = Math.min(a, b);
        const second = Math.max(a, b);
        const pairKey = `${first}:${second}`;
        if (pairSet.has(pairKey)) continue;
        pairSet.add(pairKey);

        const bodyA = bodies[first];
        const bodyB = bodies[second];
        if (overlaps(bodyA, bodyB)) {
          result.push({ a: first, b: second });
        }
      }
    }
  }

  return result;
}

export function bruteForcePairs(bodies: CircleBody[]): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      if (overlaps(bodies[i], bodies[j])) {
        out.push({ a: i, b: j });
      }
    }
  }
  return out;
}
