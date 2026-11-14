import { createReplaySeed } from '../src/sim/world';
import { recordReplay } from '../src/sim/replay';

function parseStringArg(name: string, fallback: string): string {
  const prefixed = `--${name}=`;
  const fromEquals = process.argv.find((arg) => arg.startsWith(prefixed));
  if (fromEquals) return fromEquals.slice(prefixed.length) || fallback;

  const flagIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (flagIndex >= 0) return process.argv[flagIndex + 1] || fallback;

  return fallback;
}

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
  const seed = parseStringArg('seed', 'replay-seed');
  const ticks = Math.max(1, parseNumberArg('ticks', 5000));
  const inputs = createReplaySeed(seed, ticks);

  const first = recordReplay(seed, inputs);
  const second = recordReplay(seed, inputs);
  const third = recordReplay(seed, inputs);

  const firstDigest = first.hashes.join('|');
  const secondDigest = second.hashes.join('|');
  const thirdDigest = third.hashes.join('|');
  const match = firstDigest === secondDigest && secondDigest === thirdDigest;

  if (!match) {
    throw new Error('Replay hashes diverged for identical input log.');
  }

  console.log(
    JSON.stringify(
      {
        type: 'replay_result',
        seed,
        ticks,
        hashes: first.hashes.length,
        deterministic: match,
      },
      null,
      2,
    ),
  );
}

main();
