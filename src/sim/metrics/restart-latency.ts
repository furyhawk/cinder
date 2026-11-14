import { createInputFrame, createWorld, type Difficulty } from '../world';

export interface RestartLatencyResult {
  iterations: number;
  p95Ms: number;
  maxMs: number;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[index];
}

export function measureRestartLatency(iterations = 200, difficulty: Difficulty = 'normal'): RestartLatencyResult {
  const samples: number[] = [];

  for (let attempt = 0; attempt < iterations; attempt += 1) {
    const world = createWorld(`restart-latency-${attempt}`, difficulty);
    world.state.status = 'lost';

    const startedAt = performance.now();
    world.restart();
    const beforeTick = world.state.tick;
    world.step(createInputFrame(beforeTick, { aimX: 1, aimY: 0, fire: true }));
    const elapsed = performance.now() - startedAt;

    if (world.state.tick <= beforeTick) {
      throw new Error('Restart did not accept first input frame.');
    }
    samples.push(elapsed);
  }

  return {
    iterations,
    p95Ms: percentile(samples, 95),
    maxMs: Math.max(...samples),
  };
}
