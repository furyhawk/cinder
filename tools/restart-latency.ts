import { measureRestartLatency } from '../src/sim/metrics/restart-latency';

function parseNumberArg(name: string, fallback: number): number {
  const prefixed = `--${name}=`;
  const fromEquals = process.argv.find((arg) => arg.startsWith(prefixed));
  if (fromEquals) {
    const value = Number(fromEquals.slice(prefixed.length));
    return Number.isFinite(value) ? value : fallback;
  }

  const flagIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (flagIndex >= 0) {
    const value = Number(process.argv[flagIndex + 1]);
    return Number.isFinite(value) ? value : fallback;
  }

  return fallback;
}

export function main() {
  const iterations = Math.max(1, parseNumberArg('iterations', 200));
  const result = measureRestartLatency(iterations, 'normal');
  const p95Ms = Number(result.p95Ms.toFixed(3));
  const maxMs = Number(result.maxMs.toFixed(3));

  console.log(
    JSON.stringify(
      {
        type: 'restart_latency',
        iterations: result.iterations,
        p95Ms,
        maxMs,
        thresholdMs: 1500,
      },
      null,
      2,
    ),
  );

  if (p95Ms > 1500) {
    throw new Error(`Restart latency budget exceeded: p95=${p95Ms}ms`);
  }
}

main();
