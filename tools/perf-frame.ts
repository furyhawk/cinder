import { createInputFrame, createWorld } from '../src/sim/world';

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[index];
}

export function main() {
  const world = createWorld('perf-frame', 'normal');
  const samples: number[] = [];

  for (let tick = 0; tick < 4000; tick += 1) {
    const start = performance.now();
    world.step(
      createInputFrame(tick, {
        moveX: Math.sin(tick / 30),
        moveY: Math.cos(tick / 27),
        aimX: Math.cos(tick / 20),
        aimY: Math.sin(tick / 24),
        fire: true,
        surge: tick % 90 === 0,
      }),
    );
    const elapsed = performance.now() - start;
    samples.push(elapsed);
  }

  const p95 = percentile(samples, 95);
  console.log(JSON.stringify({ metric: 'sim_step_ms_p95', p95 }, null, 2));
  if (p95 > 8) {
    throw new Error(`perf:frame budget exceeded: p95=${p95.toFixed(3)}ms`);
  }
}

main();
