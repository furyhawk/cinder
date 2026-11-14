import { createWorld, type InputFrame, type World } from './world';

export interface ReplayRecord {
  seed: string;
  buildHash: string;
  inputs: InputFrame[];
  hashes: string[];
}

export function replayInputs(seed: string, inputs: InputFrame[]): string[] {
  const world: World = createWorld(seed);
  const hashes: string[] = [];

  for (const input of inputs) {
    world.step(input);
    hashes.push(world.hash());
  }

  return hashes;
}

export function recordReplay(seed: string, inputs: InputFrame[]): ReplayRecord {
  return {
    seed,
    buildHash: 'dot-v1',
    inputs,
    hashes: replayInputs(seed, inputs),
  };
}
